import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { contactsTable, importBatchesTable, importLogEntriesTable } from '../db/schema';
import { type StartImportInput } from '../schema';
import { startImport } from '../handlers/start_import';
import { eq } from 'drizzle-orm';

// Helper function to create base64 encoded CSV content
const createCsvBase64 = (content: string): string => {
  return Buffer.from(content).toString('base64');
};

// Valid test CSV data
const validCsvData = `nombre,apellido,email,telefono
Juan,Perez,juan@example.com,123456789
Maria,Garcia,maria@example.com,987654321
Pedro,Lopez,,555123456
Ana,Rodriguez,ana@example.com,`;

// Test input with valid CSV
const validTestInput: StartImportInput = {
  csvData: createCsvBase64(validCsvData),
  filename: 'test_contacts.csv'
};

describe('startImport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully import valid contacts', async () => {
    const result = await startImport(validTestInput);

    // Verify batch record
    expect(result.filename).toEqual('test_contacts.csv');
    expect(result.total_records).toEqual(4);
    expect(result.successful_records).toEqual(4);
    expect(result.failed_records).toEqual(0);
    expect(result.status).toEqual('completed');
    expect(result.error_log).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeInstanceOf(Date);
  });

  it('should save contacts to database correctly', async () => {
    await startImport(validTestInput);

    // Verify contacts were created
    const contacts = await db.select()
      .from(contactsTable)
      .execute();

    expect(contacts).toHaveLength(4);
    
    // Check specific contact data
    const juanContact = contacts.find(c => c.nombre === 'Juan');
    expect(juanContact).toBeDefined();
    expect(juanContact?.apellido).toEqual('Perez');
    expect(juanContact?.email).toEqual('juan@example.com');
    expect(juanContact?.telefono).toEqual('123456789');

    // Check contact with missing optional fields
    const pedroContact = contacts.find(c => c.nombre === 'Pedro');
    expect(pedroContact).toBeDefined();
    expect(pedroContact?.email).toBeNull();
    expect(pedroContact?.telefono).toEqual('555123456');

    const anaContact = contacts.find(c => c.nombre === 'Ana');
    expect(anaContact).toBeDefined();
    expect(anaContact?.telefono).toBeNull();
    expect(anaContact?.email).toEqual('ana@example.com');
  });

  it('should create import log entries for successful imports', async () => {
    const result = await startImport(validTestInput);

    // Verify log entries were created
    const logEntries = await db.select()
      .from(importLogEntriesTable)
      .where(eq(importLogEntriesTable.import_batch_id, result.id))
      .execute();

    expect(logEntries).toHaveLength(4);
    
    // All entries should be successful
    logEntries.forEach(entry => {
      expect(entry.status).toEqual('success');
      expect(entry.error_message).toBeNull();
      expect(entry.raw_data).toBeDefined();
      expect(JSON.parse(entry.raw_data)).toBeObject();
    });
  });

  it('should handle validation errors correctly', async () => {
    const invalidCsvData = `nombre,apellido,email,telefono
Juan,Perez,juan@example.com,123456789
,Garcia,maria@example.com,987654321
Pedro,,invalid-email,555123456`;

    const invalidTestInput: StartImportInput = {
      csvData: createCsvBase64(invalidCsvData),
      filename: 'invalid_contacts.csv'
    };

    const result = await startImport(invalidTestInput);

    // Verify batch statistics
    expect(result.total_records).toEqual(3);
    expect(result.successful_records).toEqual(1); // Only Juan should succeed
    expect(result.failed_records).toEqual(2);
    expect(result.status).toEqual('completed'); // Mixed results

    // Verify only valid contact was created
    const contacts = await db.select()
      .from(contactsTable)
      .execute();

    expect(contacts).toHaveLength(1);
    expect(contacts[0].nombre).toEqual('Juan');

    // Verify error log entries
    const logEntries = await db.select()
      .from(importLogEntriesTable)
      .where(eq(importLogEntriesTable.import_batch_id, result.id))
      .execute();

    expect(logEntries).toHaveLength(3);
    
    const errorEntries = logEntries.filter(entry => entry.status === 'error');
    expect(errorEntries).toHaveLength(2);
    
    errorEntries.forEach(entry => {
      expect(entry.error_message).toContain('Validation failed');
    });
  });

  it('should prevent duplicate email imports', async () => {
    // First, create an existing contact
    await db.insert(contactsTable).values({
      nombre: 'Existing',
      apellido: 'User',
      email: 'juan@example.com',
      telefono: '999999999'
    });

    const result = await startImport(validTestInput);

    // Verify batch statistics - Juan should fail due to duplicate email
    expect(result.total_records).toEqual(4);
    expect(result.successful_records).toEqual(3);
    expect(result.failed_records).toEqual(1);
    expect(result.status).toEqual('completed');

    // Verify Juan was not imported again
    const juanContacts = await db.select()
      .from(contactsTable)
      .where(eq(contactsTable.email, 'juan@example.com'))
      .execute();

    expect(juanContacts).toHaveLength(1);
    expect(juanContacts[0].nombre).toEqual('Existing'); // Original contact

    // Verify duplicate error was logged
    const logEntries = await db.select()
      .from(importLogEntriesTable)
      .where(eq(importLogEntriesTable.import_batch_id, result.id))
      .execute();

    const duplicateError = logEntries.find(entry => 
      entry.status === 'error' && entry.error_message?.includes('Duplicate email')
    );
    expect(duplicateError).toBeDefined();
  });

  it('should prevent duplicate phone imports', async () => {
    // First, create an existing contact with duplicate phone
    await db.insert(contactsTable).values({
      nombre: 'Existing',
      apellido: 'User',
      email: 'existing@example.com',
      telefono: '123456789'
    });

    const result = await startImport(validTestInput);

    // Verify Juan failed due to duplicate phone
    expect(result.successful_records).toEqual(3);
    expect(result.failed_records).toEqual(1);

    // Verify duplicate phone error was logged
    const logEntries = await db.select()
      .from(importLogEntriesTable)
      .where(eq(importLogEntriesTable.import_batch_id, result.id))
      .execute();

    const duplicateError = logEntries.find(entry => 
      entry.status === 'error' && entry.error_message?.includes('Duplicate telefono')
    );
    expect(duplicateError).toBeDefined();
  });

  it('should handle empty CSV file', async () => {
    const emptyTestInput: StartImportInput = {
      csvData: createCsvBase64(''),
      filename: 'empty.csv'
    };

    await expect(startImport(emptyTestInput)).rejects.toThrow(/CSV file is empty/i);
  });

  it('should handle missing required columns', async () => {
    const invalidHeaderCsv = `email,telefono
juan@example.com,123456789`;

    const testInput: StartImportInput = {
      csvData: createCsvBase64(invalidHeaderCsv),
      filename: 'invalid_header.csv'
    };

    await expect(startImport(testInput)).rejects.toThrow(/CSV must contain nombre and apellido columns/i);
  });

  it('should handle large import batches efficiently', async () => {
    // Generate a larger CSV for performance testing
    let largeCsvData = 'nombre,apellido,email,telefono\n';
    const numRecords = 2500; // Test chunking (chunk size is 1000)

    for (let i = 1; i <= numRecords; i++) {
      largeCsvData += `Person${i},Lastname${i},person${i}@example.com,123456${i.toString().padStart(3, '0')}\n`;
    }

    const largeTestInput: StartImportInput = {
      csvData: createCsvBase64(largeCsvData.trim()),
      filename: 'large_contacts.csv'
    };

    const result = await startImport(largeTestInput);

    // Verify all records were processed successfully
    expect(result.total_records).toEqual(numRecords);
    expect(result.successful_records).toEqual(numRecords);
    expect(result.failed_records).toEqual(0);
    expect(result.status).toEqual('completed');

    // Verify all contacts were created
    const contacts = await db.select()
      .from(contactsTable)
      .execute();

    expect(contacts).toHaveLength(numRecords);
  });

  it('should handle CSV with quoted fields correctly', async () => {
    const quotedCsvData = `nombre,apellido,email,telefono
"Juan Carlos","De la Rosa","juan.carlos@example.com","123-456-789"
"Maria Elena","Garcia Lopez","maria.elena@example.com","987-654-321"`;

    const quotedTestInput: StartImportInput = {
      csvData: createCsvBase64(quotedCsvData),
      filename: 'quoted_contacts.csv'
    };

    const result = await startImport(quotedTestInput);

    expect(result.successful_records).toEqual(2);
    expect(result.failed_records).toEqual(0);

    // Verify contacts were created with correct data
    const contacts = await db.select()
      .from(contactsTable)
      .execute();

    const juanContact = contacts.find(c => c.nombre === 'Juan Carlos');
    expect(juanContact).toBeDefined();
    expect(juanContact?.apellido).toEqual('De la Rosa');
    expect(juanContact?.email).toEqual('juan.carlos@example.com');
    expect(juanContact?.telefono).toEqual('123-456-789');
  });
});