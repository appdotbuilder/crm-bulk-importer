import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { importBatchesTable, importLogEntriesTable } from '../db/schema';
import { getImportLog } from '../handlers/get_import_log';
import { eq } from 'drizzle-orm';

describe('getImportLog', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve import log entries for a specific batch', async () => {
    // Create an import batch first
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'test.csv',
        total_records: 3,
        successful_records: 2,
        failed_records: 1,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create multiple log entries for this batch
    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'John', apellido: 'Doe', email: 'john@example.com' })
        },
        {
          import_batch_id: batchId,
          row_number: 2,
          status: 'error',
          error_message: 'Email inválido',
          raw_data: JSON.stringify({ nombre: 'Jane', apellido: 'Smith', email: 'invalid-email' })
        },
        {
          import_batch_id: batchId,
          row_number: 3,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Bob', apellido: 'Johnson', telefono: '123456789' })
        }
      ])
      .execute();

    const result = await getImportLog(batchId);

    expect(result).toHaveLength(3);
    
    // Verify entries are ordered by row_number
    expect(result[0].row_number).toBe(1);
    expect(result[1].row_number).toBe(2);
    expect(result[2].row_number).toBe(3);

    // Verify successful entry
    expect(result[0].status).toBe('success');
    expect(result[0].error_message).toBeNull();
    expect(result[0].raw_data).toBe('{"nombre":"John","apellido":"Doe","email":"john@example.com"}');

    // Verify error entry
    expect(result[1].status).toBe('error');
    expect(result[1].error_message).toBe('Email inválido');
    expect(result[1].raw_data).toBe('{"nombre":"Jane","apellido":"Smith","email":"invalid-email"}');

    // Verify all entries have correct batch_id
    result.forEach(entry => {
      expect(entry.import_batch_id).toBe(batchId);
      expect(entry.id).toBeDefined();
      expect(entry.created_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array for non-existent batch', async () => {
    const result = await getImportLog(999);
    expect(result).toHaveLength(0);
  });

  it('should return empty array for batch with no log entries', async () => {
    // Create a batch but no log entries
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'empty.csv',
        total_records: 0,
        successful_records: 0,
        failed_records: 0,
        status: 'pending'
      })
      .returning()
      .execute();

    const result = await getImportLog(batchResult[0].id);
    expect(result).toHaveLength(0);
  });

  it('should handle batch with only successful entries', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'success.csv',
        total_records: 2,
        successful_records: 2,
        failed_records: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Alice', apellido: 'Wonder' })
        },
        {
          import_batch_id: batchId,
          row_number: 2,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Bob', apellido: 'Builder' })
        }
      ])
      .execute();

    const result = await getImportLog(batchId);

    expect(result).toHaveLength(2);
    result.forEach(entry => {
      expect(entry.status).toBe('success');
      expect(entry.error_message).toBeNull();
    });
  });

  it('should handle batch with only failed entries', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'failures.csv',
        total_records: 2,
        successful_records: 0,
        failed_records: 2,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 1,
          status: 'error',
          error_message: 'Nombre es obligatorio',
          raw_data: JSON.stringify({ nombre: '', apellido: 'Smith' })
        },
        {
          import_batch_id: batchId,
          row_number: 2,
          status: 'error',
          error_message: 'Email inválido',
          raw_data: JSON.stringify({ nombre: 'Jane', apellido: 'Doe', email: 'not-an-email' })
        }
      ])
      .execute();

    const result = await getImportLog(batchId);

    expect(result).toHaveLength(2);
    result.forEach(entry => {
      expect(entry.status).toBe('error');
      expect(entry.error_message).toBeDefined();
      expect(typeof entry.error_message).toBe('string');
    });
  });

  it('should not return log entries from other batches', async () => {
    // Create two different batches
    const batch1Result = await db.insert(importBatchesTable)
      .values({
        filename: 'batch1.csv',
        total_records: 1,
        successful_records: 1,
        failed_records: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const batch2Result = await db.insert(importBatchesTable)
      .values({
        filename: 'batch2.csv',
        total_records: 1,
        successful_records: 1,
        failed_records: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const batch1Id = batch1Result[0].id;
    const batch2Id = batch2Result[0].id;

    // Create log entries for both batches
    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batch1Id,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Batch1', apellido: 'User' })
        },
        {
          import_batch_id: batch2Id,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Batch2', apellido: 'User' })
        }
      ])
      .execute();

    // Query for batch1 logs
    const batch1Logs = await getImportLog(batch1Id);
    expect(batch1Logs).toHaveLength(1);
    expect(batch1Logs[0].import_batch_id).toBe(batch1Id);
    expect(batch1Logs[0].raw_data).toBe('{"nombre":"Batch1","apellido":"User"}');

    // Query for batch2 logs
    const batch2Logs = await getImportLog(batch2Id);
    expect(batch2Logs).toHaveLength(1);
    expect(batch2Logs[0].import_batch_id).toBe(batch2Id);
    expect(batch2Logs[0].raw_data).toBe('{"nombre":"Batch2","apellido":"User"}');
  });

  it('should maintain row order even with mixed row numbers', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        filename: 'mixed.csv',
        total_records: 4,
        successful_records: 2,
        failed_records: 2,
        status: 'completed'
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Insert entries in non-sequential order to test ordering
    await db.insert(importLogEntriesTable)
      .values([
        {
          import_batch_id: batchId,
          row_number: 10,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'Last', apellido: 'User' })
        },
        {
          import_batch_id: batchId,
          row_number: 3,
          status: 'error',
          error_message: 'Some error',
          raw_data: JSON.stringify({ nombre: 'Third', apellido: 'User' })
        },
        {
          import_batch_id: batchId,
          row_number: 1,
          status: 'success',
          error_message: null,
          raw_data: JSON.stringify({ nombre: 'First', apellido: 'User' })
        },
        {
          import_batch_id: batchId,
          row_number: 5,
          status: 'error',
          error_message: 'Another error',
          raw_data: JSON.stringify({ nombre: 'Fifth', apellido: 'User' })
        }
      ])
      .execute();

    const result = await getImportLog(batchId);

    expect(result).toHaveLength(4);
    
    // Verify entries are returned in row_number order
    expect(result[0].row_number).toBe(1);
    expect(result[1].row_number).toBe(3);
    expect(result[2].row_number).toBe(5);
    expect(result[3].row_number).toBe(10);
    
    // Verify the corresponding data matches the expected order
    expect(JSON.parse(result[0].raw_data).nombre).toBe('First');
    expect(JSON.parse(result[1].raw_data).nombre).toBe('Third');
    expect(JSON.parse(result[2].raw_data).nombre).toBe('Fifth');
    expect(JSON.parse(result[3].raw_data).nombre).toBe('Last');
  });
});