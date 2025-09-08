import { db } from '../db';
import { importLogEntriesTable } from '../db/schema';
import { type ImportLogEntry } from '../schema';
import { eq, asc } from 'drizzle-orm';

/**
 * Handler to retrieve detailed import logs for a specific batch
 * Returns all log entries with error details for user review and download
 */
export async function getImportLog(batchId: number): Promise<ImportLogEntry[]> {
  try {
    // Query all import log entries for the specified batch
    // Order by row_number to maintain the original CSV order for easier review
    const results = await db.select()
      .from(importLogEntriesTable)
      .where(eq(importLogEntriesTable.import_batch_id, batchId))
      .orderBy(asc(importLogEntriesTable.row_number))
      .execute();

    // Return the log entries - no type conversion needed as all fields are already correct types
    return results;
  } catch (error) {
    console.error('Failed to retrieve import log:', error);
    throw error;
  }
}