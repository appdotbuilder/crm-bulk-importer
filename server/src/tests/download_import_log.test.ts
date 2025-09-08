import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { importBatchesTable, importLogEntriesTable } from '../db/schema';
import { downloadImportLog } from '../handlers/download_import_log';

describe('downloadImportLog', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate CSV log for successful import batch', async () => {
    // Create a test import batch
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'test_contacts.csv',
        total_records: 2,
        successful_records: 2,
        failed_records: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create successful log entries
    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({
            nombre: 'Juan',
            apellido: 'Pérez',
            email: 'juan@example.com',
            telefono: '+34123456789'
          })
        },
        {
          import_batch_id: batchId,
          row_number: 2,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({
            nombre: 'María',
            apellido: 'García',
            email: 'maria@example.com',
            telefono: '+34987654321'
          })
        }
      ])
      .execute();

    const csvContent = await downloadImportLog(batchId);

    // Verify CSV structure
    const lines = csvContent.split('\n');
    
    // Check summary header (should contain batch info)
    expect(lines[0]).toContain('test_contacts.csv');
    expect(lines[2]).toContain('Total de registros: 2');
    expect(lines[3]).toContain('Exitosos: 2');
    expect(lines[4]).toContain('Fallidos: 0');
    expect(lines[5]).toContain('Estado: completed');

    // Check column headers
    expect(lines[7]).toBe('Fila,Estado,Mensaje de Error,Nombre,Apellido,Email,Teléfono');

    // Check data rows
    expect(lines[8]).toBe('1,Exitoso,,Juan,Pérez,juan@example.com,+34123456789');
    expect(lines[9]).toBe('2,Exitoso,,María,García,maria@example.com,+34987654321');
  });

  it('should generate CSV log for failed import batch', async () => {
    // Create a test import batch with errors
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'failed_contacts.csv',
        total_records: 2,
        successful_records: 1,
        failed_records: 1,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create mixed log entries
    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({
            nombre: 'Juan',
            apellido: 'Pérez',
            email: 'juan@example.com',
            telefono: null
          })
        },
        {
          import_batch_id: batchId,
          row_number: 2,
          status: 'error',
          error_message: 'Email inválido',
          raw_data: JSON.stringify({
            nombre: 'María',
            apellido: 'García',
            email: 'invalid-email',
            telefono: '+34987654321'
          })
        }
      ])
      .execute();

    const csvContent = await downloadImportLog(batchId);

    const lines = csvContent.split('\n');
    
    // Check summary shows mixed results
    expect(lines[3]).toContain('Exitosos: 1');
    expect(lines[4]).toContain('Fallidos: 1');

    // Check data rows
    expect(lines[8]).toBe('1,Exitoso,,Juan,Pérez,juan@example.com,');
    expect(lines[9]).toBe('2,Error,Email inválido,María,García,invalid-email,+34987654321');
  });

  it('should handle CSV values with commas and quotes', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'special_chars.csv',
        total_records: 1,
        successful_records: 0,
        failed_records: 1,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create log entry with special characters
    await db.insert(importLogEntriesTable)
      .values({
        import_batch_id: batchId,
        row_number: 1,
        status: 'error',
        error_message: 'Error con "comillas" y, comas',
        raw_data: JSON.stringify({
          nombre: 'Juan, Jr.',
          apellido: 'Pérez "El Grande"',
          email: 'juan@example.com',
          telefono: '+34123456789'
        })
      })
      .execute();

    const csvContent = await downloadImportLog(batchId);

    const lines = csvContent.split('\n');
    
    // Check that values with special characters are properly escaped
    expect(lines[8]).toBe('1,Error,"Error con ""comillas"" y, comas","Juan, Jr.","Pérez ""El Grande""",juan@example.com,+34123456789');
  });

  it('should handle missing or null raw data fields', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'incomplete_data.csv',
        total_records: 1,
        successful_records: 0,
        failed_records: 1,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create log entry with incomplete raw data
    await db.insert(importLogEntriesTable)
      .values({
        import_batch_id: batchId,
        row_number: 1,
        status: 'error',
        error_message: 'Datos incompletos',
        raw_data: JSON.stringify({
          nombre: 'Juan',
          // Missing apellido, email, telefono
        })
      })
      .execute();

    const csvContent = await downloadImportLog(batchId);

    const lines = csvContent.split('\n');
    
    // Check that missing fields are represented as empty strings
    expect(lines[8]).toBe('1,Error,Datos incompletos,Juan,,,');
  });

  it('should handle invalid JSON in raw_data', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'invalid_json.csv',
        total_records: 1,
        successful_records: 0,
        failed_records: 1,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create log entry with invalid JSON
    await db.insert(importLogEntriesTable)
      .values({
        import_batch_id: batchId,
        row_number: 1,
        status: 'error',
        error_message: 'JSON inválido',
        raw_data: 'invalid json string'
      })
      .execute();

    const csvContent = await downloadImportLog(batchId);

    const lines = csvContent.split('\n');
    
    // Check that invalid JSON is handled gracefully with empty fields
    expect(lines[8]).toBe('1,Error,JSON inválido,,,,');
  });

  it('should order log entries by row number', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'ordered_test.csv',
        total_records: 3,
        successful_records: 3,
        failed_records: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Insert log entries in non-sequential order
    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 3,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Carlos', apellido: 'López', email: 'carlos@example.com', telefono: null })
        },
        {
          import_batch_id: batchId,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Ana', apellido: 'Martín', email: 'ana@example.com', telefono: null })
        },
        {
          import_batch_id: batchId,
          row_number: 2,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Luis', apellido: 'Rodríguez', email: 'luis@example.com', telefono: null })
        }
      ])
      .execute();

    const csvContent = await downloadImportLog(batchId);

    const lines = csvContent.split('\n');
    
    // Verify rows are ordered by row number
    expect(lines[8]).toContain('1,Exitoso,,Ana,Martín');
    expect(lines[9]).toContain('2,Exitoso,,Luis,Rodríguez');
    expect(lines[10]).toContain('3,Exitoso,,Carlos,López');
  });

  it('should throw error for non-existent batch', async () => {
    const nonExistentBatchId = 99999;

    await expect(downloadImportLog(nonExistentBatchId))
      .rejects
      .toThrow(/Import batch with ID 99999 not found/);
  });

  it('should include proper date formatting in summary', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'date_test.csv',
        total_records: 1,
        successful_records: 1,
        failed_records: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const csvContent = await downloadImportLog(batchResult[0].id);

    const lines = csvContent.split('\n');
    
    // Check that date is formatted in Spanish locale
    expect(lines[1]).toMatch(/Fecha: \d{1,2}\/\d{1,2}\/\d{4}/);
  });
});