import { db } from '../db';
import { importBatchesTable } from '../db/schema';
import { type ImportBatch } from '../schema';
import { desc } from 'drizzle-orm';

/**
 * Handler to retrieve all import batches with their summary information
 * Provides users with a history of their import operations
 */
export async function getImportBatches(): Promise<ImportBatch[]> {
  try {
    // Query all import batches ordered by creation date (most recent first)
    const results = await db.select()
      .from(importBatchesTable)
      .orderBy(desc(importBatchesTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to retrieve import batches:', error);
    throw error;
  }
}