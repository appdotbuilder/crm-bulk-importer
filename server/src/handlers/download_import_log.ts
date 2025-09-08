import { db } from '../db';
import { importBatchesTable, importLogEntriesTable } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Handler to generate downloadable CSV log for import batch results
 * Creates a detailed report that users can download and analyze offline
 */
export async function downloadImportLog(batchId: number): Promise<string> {
  try {
    // First, get the import batch information
    const importBatch = await db.select()
      .from(importBatchesTable)
      .where(eq(importBatchesTable.id, batchId))
      .execute();

    if (!importBatch || importBatch.length === 0) {
      throw new Error(`Import batch with ID ${batchId} not found`);
    }

    const batch = importBatch[0];

    // Get all log entries for this batch, ordered by row number
    const logEntries = await db.select()
      .from(importLogEntriesTable)
      .where(eq(importLogEntriesTable.import_batch_id, batchId))
      .orderBy(importLogEntriesTable.row_number)
      .execute();

    // Start building CSV content with summary information
    const csvLines: string[] = [];
    
    // Add summary header
    csvLines.push(`Reporte de Importación - ${batch.filename}`);
    csvLines.push(`Fecha: ${batch.created_at.toLocaleDateString('es-ES')}`);
    csvLines.push(`Total de registros: ${batch.total_records}`);
    csvLines.push(`Exitosos: ${batch.successful_records}`);
    csvLines.push(`Fallidos: ${batch.failed_records}`);
    csvLines.push(`Estado: ${batch.status}`);
    csvLines.push(''); // Empty line separator

    // Add column headers
    csvLines.push('Fila,Estado,Mensaje de Error,Nombre,Apellido,Email,Teléfono');

    // Process each log entry
    for (const entry of logEntries) {
      let rawData;
      try {
        rawData = JSON.parse(entry.raw_data);
      } catch {
        rawData = {};
      }

      const estado = entry.status === 'success' ? 'Exitoso' : 'Error';
      const errorMessage = entry.error_message || '';
      const nombre = rawData.nombre || '';
      const apellido = rawData.apellido || '';
      const email = rawData.email || '';
      const telefono = rawData.telefono || '';

      // Escape CSV values that contain commas or quotes
      const escapeCsvValue = (value: string): string => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvRow = [
        entry.row_number.toString(),
        escapeCsvValue(estado),
        escapeCsvValue(errorMessage),
        escapeCsvValue(nombre),
        escapeCsvValue(apellido),
        escapeCsvValue(email),
        escapeCsvValue(telefono)
      ].join(',');

      csvLines.push(csvRow);
    }

    return csvLines.join('\n');
  } catch (error) {
    console.error('Download import log failed:', error);
    throw error;
  }
}