import { db } from '../db';
import { contactsTable, importBatchesTable, importLogEntriesTable } from '../db/schema';
import { type StartImportInput, type ImportBatch, csvRowSchema } from '../schema';
import { eq, or } from 'drizzle-orm';

/**
 * Handler to start the actual contact import process
 * Creates an import batch record and begins processing CSV data in batches for optimization
 */
export async function startImport(input: StartImportInput): Promise<ImportBatch> {
  try {
    // Decode CSV data from base64
    const csvContent = Buffer.from(input.csvData, 'base64').toString('utf-8');
    
    // Parse CSV content
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
      throw new Error('CSV file is empty');
    }
    
    // Extract header and data rows
    const header = lines[0].split(',').map(col => col.trim().toLowerCase());
    const dataRows = lines.slice(1);
    
    // Validate header format
    const requiredColumns = ['nombre', 'apellido'];
    const optionalColumns = ['email', 'telefono'];
    const validColumns = [...requiredColumns, ...optionalColumns];
    
    if (!requiredColumns.every(col => header.includes(col))) {
      throw new Error('CSV must contain nombre and apellido columns');
    }
    
    // Create initial import batch record
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: input.filename,
        total_records: dataRows.length,
        status: 'processing'
      })
      .returning()
      .execute();
    
    const importBatch = batchResult[0];
    let successfulRecords = 0;
    let failedRecords = 0;
    const errorLog: string[] = [];
    
    // Process rows in chunks for better performance
    const CHUNK_SIZE = 1000;
    const chunks: string[][] = [];
    for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
      chunks.push(dataRows.slice(i, i + CHUNK_SIZE));
    }
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      await db.transaction(async (tx) => {
        for (let i = 0; i < chunk.length; i++) {
          const rowIndex = chunkIndex * CHUNK_SIZE + i + 1; // 1-based row number
          const row = chunk[i];
          
          try {
            // Parse CSV row
            const values = row.split(',').map(val => val.trim().replace(/^"|"$/g, '')); // Remove quotes
            const rowData: Record<string, string> = {};
            
            header.forEach((col, index) => {
              if (validColumns.includes(col) && index < values.length) {
                rowData[col] = values[index] || '';
              }
            });
            
            // Convert empty strings to null for nullable fields
            const processedData = {
              nombre: rowData['nombre'] || '',
              apellido: rowData['apellido'] || '',
              email: rowData['email'] === '' ? null : rowData['email'],
              telefono: rowData['telefono'] === '' ? null : rowData['telefono']
            };
            
            // Validate row data
            const validation = csvRowSchema.safeParse(processedData);
            
            if (!validation.success) {
              const errors = validation.error.errors.map(err => err.message).join(', ');
              failedRecords++;
              
              // Log failed row
              await tx.insert(importLogEntriesTable).values({
                import_batch_id: importBatch.id,
                row_number: rowIndex,
                status: 'error',
                error_message: `Validation failed: ${errors}`,
                raw_data: JSON.stringify(rowData)
              });
              
              continue;
            }
            
            const validData = validation.data;
            
            // Check for duplicates if email or telefono are provided
            const duplicateConditions = [];
            if (validData.email) {
              duplicateConditions.push(eq(contactsTable.email, validData.email));
            }
            if (validData.telefono) {
              duplicateConditions.push(eq(contactsTable.telefono, validData.telefono));
            }
            
            if (duplicateConditions.length > 0) {
              const existingContacts = await tx.select()
                .from(contactsTable)
                .where(or(...duplicateConditions))
                .execute();
              
              if (existingContacts.length > 0) {
                const duplicateField = existingContacts.some(c => c.email === validData.email) ? 'email' : 'telefono';
                failedRecords++;
                
                // Log duplicate row
                await tx.insert(importLogEntriesTable).values({
                  import_batch_id: importBatch.id,
                  row_number: rowIndex,
                  status: 'error',
                  error_message: `Duplicate ${duplicateField}: ${validData[duplicateField as keyof typeof validData]}`,
                  raw_data: JSON.stringify(rowData)
                });
                
                continue;
              }
            }
            
            // Insert valid contact
            await tx.insert(contactsTable).values({
              nombre: validData.nombre,
              apellido: validData.apellido,
              email: validData.email,
              telefono: validData.telefono
            });
            
            successfulRecords++;
            
            // Log successful row
            await tx.insert(importLogEntriesTable).values({
              import_batch_id: importBatch.id,
              row_number: rowIndex,
              status: 'success',
              error_message: null,
              raw_data: JSON.stringify(rowData)
            });
            
          } catch (error) {
            failedRecords++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            errorLog.push(`Row ${rowIndex}: ${errorMessage}`);
            
            // Log processing error
            await tx.insert(importLogEntriesTable).values({
              import_batch_id: importBatch.id,
              row_number: rowIndex,
              status: 'error',
              error_message: errorMessage,
              raw_data: JSON.stringify({})
            });
          }
        }
      });
    }
    
    // Update import batch with final results
    const finalStatus = failedRecords === 0 ? 'completed' : (successfulRecords === 0 ? 'failed' : 'completed');
    const finalErrorLog = errorLog.length > 0 ? JSON.stringify(errorLog) : null;
    
    const updatedBatchResult = await db.update(importBatchesTable)
      .set({
        successful_records: successfulRecords,
        failed_records: failedRecords,
        status: finalStatus,
        error_log: finalErrorLog,
        completed_at: new Date()
      })
      .where(eq(importBatchesTable.id, importBatch.id))
      .returning()
      .execute();
    
    return updatedBatchResult[0];
    
  } catch (error) {
    console.error('Import process failed:', error);
    throw error;
  }
}