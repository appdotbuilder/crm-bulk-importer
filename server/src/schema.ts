import { z } from 'zod';

// Contact schema with proper validation
export const contactSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  apellido: z.string(),
  email: z.string().email().nullable(),
  telefono: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Contact = z.infer<typeof contactSchema>;

// Input schema for creating contacts
export const createContactInputSchema = z.object({
  nombre: z.string().min(1, "Nombre es obligatorio"),
  apellido: z.string().min(1, "Apellido es obligatorio"),
  email: z.string().email("Email inválido").nullable(),
  telefono: z.string().nullable()
});

export type CreateContactInput = z.infer<typeof createContactInputSchema>;

// Import batch schema
export const importBatchSchema = z.object({
  id: z.number(),
  filename: z.string(),
  total_records: z.number().int(),
  successful_records: z.number().int(),
  failed_records: z.number().int(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  error_log: z.string().nullable(),
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable()
});

export type ImportBatch = z.infer<typeof importBatchSchema>;

// Import log entry schema
export const importLogEntrySchema = z.object({
  id: z.number(),
  import_batch_id: z.number(),
  row_number: z.number().int(),
  status: z.enum(['success', 'error']),
  error_message: z.string().nullable(),
  raw_data: z.string(), // JSON string of original CSV row data
  created_at: z.coerce.date()
});

export type ImportLogEntry = z.infer<typeof importLogEntrySchema>;

// CSV row validation schema
export const csvRowSchema = z.object({
  nombre: z.string().min(1, "Nombre es obligatorio"),
  apellido: z.string().min(1, "Apellido es obligatorio"),
  email: z.string().email("Email inválido").optional().nullable(),
  telefono: z.string().optional().nullable()
});

export type CsvRow = z.infer<typeof csvRowSchema>;

// Validation result schema
export const validationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  data: csvRowSchema.nullable()
});

export type ValidationResult = z.infer<typeof validationResultSchema>;

// Batch validation result schema
export const batchValidationResultSchema = z.object({
  totalRows: z.number().int(),
  validRows: z.array(z.object({
    rowNumber: z.number().int(),
    data: csvRowSchema
  })),
  invalidRows: z.array(z.object({
    rowNumber: z.number().int(),
    errors: z.array(z.string()),
    data: z.record(z.string()) // Raw CSV data as key-value pairs
  })),
  duplicateEmails: z.array(z.object({
    email: z.string(),
    rowNumbers: z.array(z.number().int())
  })),
  duplicatePhones: z.array(z.object({
    telefono: z.string(),
    rowNumbers: z.array(z.number().int())
  }))
});

export type BatchValidationResult = z.infer<typeof batchValidationResultSchema>;

// Import process input schema
export const startImportInputSchema = z.object({
  csvData: z.string(), // Base64 encoded CSV content
  filename: z.string()
});

export type StartImportInput = z.infer<typeof startImportInputSchema>;

// Import preview input schema
export const previewImportInputSchema = z.object({
  csvData: z.string(), // Base64 encoded CSV content
  filename: z.string()
});

export type PreviewImportInput = z.infer<typeof previewImportInputSchema>;

// Import progress schema
export const importProgressSchema = z.object({
  batchId: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  totalRecords: z.number().int(),
  processedRecords: z.number().int(),
  successfulRecords: z.number().int(),
  failedRecords: z.number().int(),
  errors: z.array(z.string())
});

export type ImportProgress = z.infer<typeof importProgressSchema>;