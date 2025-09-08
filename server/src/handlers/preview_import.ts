import { type PreviewImportInput, type BatchValidationResult, csvRowSchema } from '../schema';
import { db } from '../db';
import { contactsTable } from '../db/schema';
import { eq, or } from 'drizzle-orm';

/**
 * Handler to preview and validate CSV data before actual import
 * Parses the CSV, validates each row, checks for duplicates, and returns detailed validation results
 */
export async function previewImport(input: PreviewImportInput): Promise<BatchValidationResult> {
  try {
    // 1. Decode base64 CSV data
    const csvContent = Buffer.from(input.csvData, 'base64').toString('utf-8');
    
    // 2. Parse CSV content
    const rows = parseCsv(csvContent);
    const totalRows = rows.length;
    
    if (totalRows === 0) {
      return {
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        duplicateEmails: [],
        duplicatePhones: []
      };
    }
    
    const validRows: Array<{ rowNumber: number; data: any }> = [];
    const invalidRows: Array<{ rowNumber: number; errors: string[]; data: Record<string, string> }> = [];
    
    // 3. Validate each row according to schema rules
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1; // 1-based row numbering
      const rawRow = rows[i];
      
      // Clean and normalize data
      const cleanedRow = {
        nombre: rawRow['nombre']?.trim() || '',
        apellido: rawRow['apellido']?.trim() || '',
        email: rawRow['email']?.trim() || null,
        telefono: rawRow['telefono']?.trim() || null
      };
      
      // Handle empty string conversion to null for optional fields
      if (cleanedRow.email === '') cleanedRow.email = null;
      if (cleanedRow.telefono === '') cleanedRow.telefono = null;
      
      const validation = csvRowSchema.safeParse(cleanedRow);
      
      if (validation.success) {
        validRows.push({
          rowNumber,
          data: validation.data
        });
      } else {
        const errors = validation.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        invalidRows.push({
          rowNumber,
          errors,
          data: rawRow
        });
      }
    }
    
    // 4. Check for internal duplicates within the CSV
    const duplicateEmails = findDuplicateEmails(validRows);
    const duplicatePhones = findDuplicatePhones(validRows);
    
    // 5. Check for duplicates against existing database records
    await checkDatabaseDuplicates(validRows, duplicateEmails, duplicatePhones);
    
    return {
      totalRows,
      validRows,
      invalidRows,
      duplicateEmails,
      duplicatePhones
    };
  } catch (error) {
    console.error('CSV preview failed:', error);
    throw error;
  }
}

/**
 * Simple CSV parser that handles basic CSV format
 */
function parseCsv(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return [];
  
  // Get headers from first line
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Find duplicate emails within the CSV data
 */
function findDuplicateEmails(validRows: Array<{ rowNumber: number; data: any }>): Array<{ email: string; rowNumbers: number[] }> {
  const emailMap = new Map<string, number[]>();
  
  validRows.forEach(row => {
    if (row.data.email) {
      const email = row.data.email.toLowerCase();
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push(row.rowNumber);
    }
  });
  
  const duplicates: Array<{ email: string; rowNumbers: number[] }> = [];
  emailMap.forEach((rowNumbers, email) => {
    if (rowNumbers.length > 1) {
      duplicates.push({ email, rowNumbers });
    }
  });
  
  return duplicates;
}

/**
 * Find duplicate phone numbers within the CSV data
 */
function findDuplicatePhones(validRows: Array<{ rowNumber: number; data: any }>): Array<{ telefono: string; rowNumbers: number[] }> {
  const phoneMap = new Map<string, number[]>();
  
  validRows.forEach(row => {
    if (row.data.telefono) {
      const phone = row.data.telefono;
      if (!phoneMap.has(phone)) {
        phoneMap.set(phone, []);
      }
      phoneMap.get(phone)!.push(row.rowNumber);
    }
  });
  
  const duplicates: Array<{ telefono: string; rowNumbers: number[] }> = [];
  phoneMap.forEach((rowNumbers, telefono) => {
    if (rowNumbers.length > 1) {
      duplicates.push({ telefono, rowNumbers });
    }
  });
  
  return duplicates;
}

/**
 * Check for duplicates against existing database records
 */
async function checkDatabaseDuplicates(
  validRows: Array<{ rowNumber: number; data: any }>,
  duplicateEmails: Array<{ email: string; rowNumbers: number[] }>,
  duplicatePhones: Array<{ telefono: string; rowNumbers: number[] }>
): Promise<void> {
  // Collect all unique emails and phones to check
  const emailsToCheck = new Set<string>();
  const phonesToCheck = new Set<string>();
  
  validRows.forEach(row => {
    if (row.data.email) {
      emailsToCheck.add(row.data.email.toLowerCase());
    }
    if (row.data.telefono) {
      phonesToCheck.add(row.data.telefono);
    }
  });
  
  if (emailsToCheck.size === 0 && phonesToCheck.size === 0) {
    return; // No emails or phones to check
  }
  
  // Query existing contacts
  const conditions = [];
  if (emailsToCheck.size > 0) {
    conditions.push(...Array.from(emailsToCheck).map(email => eq(contactsTable.email, email)));
  }
  if (phonesToCheck.size > 0) {
    conditions.push(...Array.from(phonesToCheck).map(phone => eq(contactsTable.telefono, phone)));
  }
  
  if (conditions.length === 0) return;
  
  const existingContacts = await db.select({
    email: contactsTable.email,
    telefono: contactsTable.telefono
  })
  .from(contactsTable)
  .where(or(...conditions))
  .execute();
  
  // Create sets for faster lookup
  const existingEmails = new Set(
    existingContacts
      .map(c => c.email?.toLowerCase())
      .filter(email => email)
  );
  const existingPhones = new Set(
    existingContacts
      .map(c => c.telefono)
      .filter(phone => phone)
  );
  
  // Add database duplicates to the duplicate arrays
  validRows.forEach(row => {
    if (row.data.email && existingEmails.has(row.data.email.toLowerCase())) {
      // Check if this email is already in duplicateEmails
      const existingDupe = duplicateEmails.find(d => d.email === row.data.email.toLowerCase());
      if (existingDupe) {
        // Add to existing duplicate entry if not already there
        if (!existingDupe.rowNumbers.includes(row.rowNumber)) {
          existingDupe.rowNumbers.push(row.rowNumber);
        }
      } else {
        // Create new duplicate entry for database conflict
        duplicateEmails.push({
          email: row.data.email.toLowerCase(),
          rowNumbers: [row.rowNumber]
        });
      }
    }
    
    if (row.data.telefono && existingPhones.has(row.data.telefono)) {
      // Check if this phone is already in duplicatePhones
      const existingDupe = duplicatePhones.find(d => d.telefono === row.data.telefono);
      if (existingDupe) {
        // Add to existing duplicate entry if not already there
        if (!existingDupe.rowNumbers.includes(row.rowNumber)) {
          existingDupe.rowNumbers.push(row.rowNumber);
        }
      } else {
        // Create new duplicate entry for database conflict
        duplicatePhones.push({
          telefono: row.data.telefono,
          rowNumbers: [row.rowNumber]
        });
      }
    }
  });
}