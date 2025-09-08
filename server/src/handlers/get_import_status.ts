import { db } from '../db';
import { importBatchesTable, importLogEntriesTable } from '../db/schema';
import { type ImportProgress } from '../schema';
import { eq, and, count, sql } from 'drizzle-orm';

/**
 * Handler to get the current status of an import batch
 * Provides real-time progress information for the UI
 */
export async function getImportStatus(batchId: number): Promise<ImportProgress | null> {
  try {
    // Query the import batch by ID
    const batchResults = await db.select()
      .from(importBatchesTable)
      .where(eq(importBatchesTable.id, batchId))
      .execute();

    if (batchResults.length === 0) {
      return null;
    }

    const batch = batchResults[0];

    // Count processed records (both success and error)
    const processedCountResult = await db.select({
      count: count()
    })
      .from(importLogEntriesTable)
      .where(eq(importLogEntriesTable.import_batch_id, batchId))
      .execute();

    const processedRecords = processedCountResult[0]?.count || 0;

    // Get error messages from failed log entries (limit to prevent overwhelming the UI)
    const errorResults = await db.select({
      error_message: importLogEntriesTable.error_message
    })
      .from(importLogEntriesTable)
      .where(and(
        eq(importLogEntriesTable.import_batch_id, batchId),
        eq(importLogEntriesTable.status, 'error')
      ))
      .limit(10) // Limit to first 10 errors to keep response manageable
      .execute();

    // Extract non-null error messages
    const errors = errorResults
      .map(result => result.error_message)
      .filter((msg): msg is string => msg !== null);

    // Add batch-level error if exists
    if (batch.error_log) {
      errors.unshift(batch.error_log);
    }

    return {
      batchId: batch.id,
      status: batch.status,
      totalRecords: batch.total_records,
      processedRecords: processedRecords,
      successfulRecords: batch.successful_records,
      failedRecords: batch.failed_records,
      errors: errors
    };
  } catch (error) {
    console.error('Failed to get import status:', error);
    throw error;
  }
}