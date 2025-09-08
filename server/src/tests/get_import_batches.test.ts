import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { importBatchesTable } from '../db/schema';
import { getImportBatches } from '../handlers/get_import_batches';

describe('getImportBatches', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no batches exist', async () => {
    const result = await getImportBatches();
    
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all import batches ordered by creation date (newest first)', async () => {
    // Create test batches with different timestamps
    const batch1 = await db.insert(importBatchesTable)
      .values({
        filename: 'contacts1.csv',
        total_records: 100,
        successful_records: 95,
        failed_records: 5,
        status: 'completed'
      })
      .returning()
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const batch2 = await db.insert(importBatchesTable)
      .values({
        filename: 'contacts2.csv',
        total_records: 50,
        successful_records: 50,
        failed_records: 0,
        status: 'completed'
      })
      .returning()
      .execute();

    const result = await getImportBatches();

    // Should return 2 batches
    expect(result).toHaveLength(2);

    // Should be ordered by creation date (newest first)
    expect(result[0].id).toEqual(batch2[0].id);
    expect(result[1].id).toEqual(batch1[0].id);

    // Verify the most recent batch data
    expect(result[0].filename).toEqual('contacts2.csv');
    expect(result[0].total_records).toEqual(50);
    expect(result[0].successful_records).toEqual(50);
    expect(result[0].failed_records).toEqual(0);
    expect(result[0].status).toEqual('completed');
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Verify the older batch data
    expect(result[1].filename).toEqual('contacts1.csv');
    expect(result[1].total_records).toEqual(100);
    expect(result[1].successful_records).toEqual(95);
    expect(result[1].failed_records).toEqual(5);
    expect(result[1].status).toEqual('completed');
    expect(result[1].created_at).toBeInstanceOf(Date);

    // Verify timestamp ordering
    expect(result[0].created_at.getTime()).toBeGreaterThan(result[1].created_at.getTime());
  });

  it('should return batches with different statuses', async () => {
    // Create batches with various statuses
    await db.insert(importBatchesTable)
      .values([
        {
          filename: 'pending.csv',
          total_records: 25,
          status: 'pending'
        },
        {
          filename: 'processing.csv',
          total_records: 75,
          status: 'processing'
        },
        {
          filename: 'failed.csv',
          total_records: 10,
          failed_records: 10,
          status: 'failed',
          error_log: 'File format error'
        }
      ])
      .execute();

    const result = await getImportBatches();

    expect(result).toHaveLength(3);

    // Verify all different statuses are represented
    const statuses = result.map(batch => batch.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('processing');
    expect(statuses).toContain('failed');

    // Verify failed batch has error log
    const failedBatch = result.find(batch => batch.status === 'failed');
    expect(failedBatch?.error_log).toEqual('File format error');
    expect(failedBatch?.failed_records).toEqual(10);
  });

  it('should handle batches with nullable fields', async () => {
    // Create batch with minimal required fields
    await db.insert(importBatchesTable)
      .values({
        filename: 'minimal.csv',
        total_records: 1,
        // All optional fields will be null/default
      })
      .execute();

    const result = await getImportBatches();

    expect(result).toHaveLength(1);
    expect(result[0].filename).toEqual('minimal.csv');
    expect(result[0].total_records).toEqual(1);
    expect(result[0].successful_records).toEqual(0); // Default value
    expect(result[0].failed_records).toEqual(0); // Default value
    expect(result[0].status).toEqual('pending'); // Default value
    expect(result[0].error_log).toBeNull();
    expect(result[0].completed_at).toBeNull();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return large number of batches efficiently', async () => {
    // Create multiple batches to test performance
    const batchData = Array.from({ length: 20 }, (_, index) => ({
      filename: `batch_${index + 1}.csv`,
      total_records: (index + 1) * 10,
      successful_records: (index + 1) * 9,
      failed_records: index + 1,
      status: 'completed' as const
    }));

    await db.insert(importBatchesTable)
      .values(batchData)
      .execute();

    const result = await getImportBatches();

    expect(result).toHaveLength(20);
    
    // Verify all batches are returned (ordering may vary for same timestamp)
    const filenames = result.map(batch => batch.filename);
    expect(filenames).toContain('batch_1.csv');
    expect(filenames).toContain('batch_20.csv');
    
    // Verify all batches have proper data structure
    result.forEach(batch => {
      expect(batch.id).toBeDefined();
      expect(batch.filename).toBeDefined();
      expect(typeof batch.total_records).toBe('number');
      expect(typeof batch.successful_records).toBe('number');
      expect(typeof batch.failed_records).toBe('number');
      expect(batch.status).toMatch(/^(pending|processing|completed|failed)$/);
      expect(batch.created_at).toBeInstanceOf(Date);
    });
  });
});