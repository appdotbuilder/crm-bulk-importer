import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { importBatchesTable, importLogEntriesTable } from '../db/schema';
import { getImportStatus } from '../handlers/get_import_status';

describe('getImportStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent batch', async () => {
    const result = await getImportStatus(999);
    expect(result).toBeNull();
  });

  it('should return basic batch status without log entries', async () => {
    // Create a batch without any log entries
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'test.csv',
        total_records: 100,
        successful_records: 0,
        failed_records: 0,
        status: 'pending',
        error_log: null
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    const result = await getImportStatus(batchId);

    expect(result).not.toBeNull();
    expect(result!.batchId).toEqual(batchId);
    expect(result!.status).toEqual('pending');
    expect(result!.totalRecords).toEqual(100);
    expect(result!.processedRecords).toEqual(0);
    expect(result!.successfulRecords).toEqual(0);
    expect(result!.failedRecords).toEqual(0);
    expect(result!.errors).toEqual([]);
  });

  it('should return progress with processed records', async () => {
    // Create a batch with processing status
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'test.csv',
        total_records: 50,
        successful_records: 30,
        failed_records: 5,
        status: 'processing',
        error_log: null
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create log entries to simulate processed records
    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Juan', apellido: 'Pérez' })
        },
        {
          import_batch_id: batchId,
          row_number: 2,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Ana', apellido: 'García' })
        },
        {
          import_batch_id: batchId,
          row_number: 3,
          status: 'error',
          error_message: 'Email inválido',
          raw_data: JSON.stringify({ nombre: 'Pedro', apellido: 'López', email: 'invalid-email' })
        }
      ])
      .execute();

    const result = await getImportStatus(batchId);

    expect(result).not.toBeNull();
    expect(result!.batchId).toEqual(batchId);
    expect(result!.status).toEqual('processing');
    expect(result!.totalRecords).toEqual(50);
    expect(result!.processedRecords).toEqual(3); // Should count all log entries
    expect(result!.successfulRecords).toEqual(30);
    expect(result!.failedRecords).toEqual(5);
    expect(result!.errors).toEqual(['Email inválido']);
  });

  it('should return completed batch with error messages', async () => {
    // Create a completed batch with errors
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'problematic.csv',
        total_records: 10,
        successful_records: 7,
        failed_records: 3,
        status: 'completed',
        error_log: 'Some rows had validation issues'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create error log entries
    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 5,
          status: 'error',
          error_message: 'Nombre es obligatorio',
          raw_data: JSON.stringify({ apellido: 'Sánchez' })
        },
        {
          import_batch_id: batchId,
          row_number: 8,
          status: 'error',
          error_message: 'Email inválido',
          raw_data: JSON.stringify({ nombre: 'Luis', apellido: 'Martín', email: 'bad@email' })
        }
      ])
      .execute();

    const result = await getImportStatus(batchId);

    expect(result).not.toBeNull();
    expect(result!.batchId).toEqual(batchId);
    expect(result!.status).toEqual('completed');
    expect(result!.totalRecords).toEqual(10);
    expect(result!.processedRecords).toEqual(2); // Only log entries created
    expect(result!.successfulRecords).toEqual(7);
    expect(result!.failedRecords).toEqual(3);
    expect(result!.errors).toEqual([
      'Some rows had validation issues', // Batch error comes first
      'Nombre es obligatorio',
      'Email inválido'
    ]);
  });

  it('should return failed batch status', async () => {
    // Create a failed batch
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'corrupted.csv',
        total_records: 0,
        successful_records: 0,
        failed_records: 0,
        status: 'failed',
        error_log: 'CSV file could not be parsed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    const result = await getImportStatus(batchId);

    expect(result).not.toBeNull();
    expect(result!.batchId).toEqual(batchId);
    expect(result!.status).toEqual('failed');
    expect(result!.totalRecords).toEqual(0);
    expect(result!.processedRecords).toEqual(0);
    expect(result!.successfulRecords).toEqual(0);
    expect(result!.failedRecords).toEqual(0);
    expect(result!.errors).toEqual(['CSV file could not be parsed']);
  });

  it('should limit error messages to prevent overwhelming response', async () => {
    // Create a batch with many errors
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'many_errors.csv',
        total_records: 20,
        successful_records: 5,
        failed_records: 15,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create 12 error log entries (should be limited to 10)
    const errorEntries = Array.from({ length: 12 }, (_, index) => ({
      import_batch_id: batchId,
      row_number: index + 1,
      status: 'error' as const,
      error_message: `Error in row ${index + 1}`,
      raw_data: JSON.stringify({ row: index + 1 })
    }));

    await db.insert(importLogEntriesTable)
      .values(errorEntries)
      .execute();

    const result = await getImportStatus(batchId);

    expect(result).not.toBeNull();
    expect(result!.processedRecords).toEqual(12);
    expect(result!.errors.length).toBeLessThanOrEqual(10); // Should be limited to 10
    expect(result!.errors).toContain('Error in row 1');
  });

  it('should handle batch with mixed success and error log entries', async () => {
    // Create batch with mixed results
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'mixed_results.csv',
        total_records: 5,
        successful_records: 3,
        failed_records: 2,
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
          raw_data: JSON.stringify({ nombre: 'Carlos', apellido: 'Ruiz' })
        },
        {
          import_batch_id: batchId,
          row_number: 2,
          status: 'error',
          error_message: 'Duplicate email',
          raw_data: JSON.stringify({ nombre: 'María', apellido: 'González', email: 'duplicate@test.com' })
        },
        {
          import_batch_id: batchId,
          row_number: 3,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'José', apellido: 'Fernández' })
        }
      ])
      .execute();

    const result = await getImportStatus(batchId);

    expect(result).not.toBeNull();
    expect(result!.processedRecords).toEqual(3); // Total log entries
    expect(result!.successfulRecords).toEqual(3); // From batch record
    expect(result!.failedRecords).toEqual(2); // From batch record
    expect(result!.errors).toEqual(['Duplicate email']); // Only error messages
  });
});