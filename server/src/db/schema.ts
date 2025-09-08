import { serial, text, pgTable, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for import batch status
export const importStatusEnum = pgEnum('import_status', ['pending', 'processing', 'completed', 'failed']);

// Enum for import log entry status
export const logEntryStatusEnum = pgEnum('log_entry_status', ['success', 'error']);

// Contacts table
export const contactsTable = pgTable('contacts', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  apellido: text('apellido').notNull(),
  email: text('email'), // Nullable by default, unique index will be added
  telefono: text('telefono'), // Nullable by default, unique index will be added
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Import batches table - tracks each CSV import session
export const importBatchesTable = pgTable('import_batches', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  total_records: integer('total_records').notNull(),
  successful_records: integer('successful_records').default(0).notNull(),
  failed_records: integer('failed_records').default(0).notNull(),
  status: importStatusEnum('status').default('pending').notNull(),
  error_log: text('error_log'), // JSON string for storing general errors
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
});

// Import log entries table - detailed log for each row processed
export const importLogEntriesTable = pgTable('import_log_entries', {
  id: serial('id').primaryKey(),
  import_batch_id: integer('import_batch_id').notNull(),
  row_number: integer('row_number').notNull(),
  status: logEntryStatusEnum('status').notNull(),
  error_message: text('error_message'), // Specific error for this row
  raw_data: text('raw_data').notNull(), // JSON string of original CSV row data
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const importBatchesRelations = relations(importBatchesTable, ({ many }) => ({
  logEntries: many(importLogEntriesTable),
}));

export const importLogEntriesRelations = relations(importLogEntriesTable, ({ one }) => ({
  importBatch: one(importBatchesTable, {
    fields: [importLogEntriesTable.import_batch_id],
    references: [importBatchesTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Contact = typeof contactsTable.$inferSelect;
export type NewContact = typeof contactsTable.$inferInsert;

export type ImportBatch = typeof importBatchesTable.$inferSelect;
export type NewImportBatch = typeof importBatchesTable.$inferInsert;

export type ImportLogEntry = typeof importLogEntriesTable.$inferSelect;
export type NewImportLogEntry = typeof importLogEntriesTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  contacts: contactsTable,
  importBatches: importBatchesTable,
  importLogEntries: importLogEntriesTable
};

export const tableRelations = {
  importBatches: importBatchesRelations,
  importLogEntries: importLogEntriesRelations
};