import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schema types
import {
  previewImportInputSchema,
  startImportInputSchema
} from './schema';

// Import handlers
import { getCsvTemplate } from './handlers/get_csv_template';
import { previewImport } from './handlers/preview_import';
import { startImport } from './handlers/start_import';
import { getImportStatus } from './handlers/get_import_status';
import { getImportLog } from './handlers/get_import_log';
import { getImportBatches } from './handlers/get_import_batches';
import { getContacts } from './handlers/get_contacts';
import { downloadImportLog } from './handlers/download_import_log';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Step 1: Download CSV template
  getCsvTemplate: publicProcedure
    .query(() => getCsvTemplate()),

  // Step 2: Preview and validate CSV data before import
  previewImport: publicProcedure
    .input(previewImportInputSchema)
    .mutation(({ input }) => previewImport(input)),

  // Step 3: Start actual import process
  startImport: publicProcedure
    .input(startImportInputSchema)
    .mutation(({ input }) => startImport(input)),

  // Get import status for progress tracking
  getImportStatus: publicProcedure
    .input(z.object({ batchId: z.number() }))
    .query(({ input }) => getImportStatus(input.batchId)),

  // Get detailed import log for a specific batch
  getImportLog: publicProcedure
    .input(z.object({ batchId: z.number() }))
    .query(({ input }) => getImportLog(input.batchId)),

  // Download import log as CSV
  downloadImportLog: publicProcedure
    .input(z.object({ batchId: z.number() }))
    .query(({ input }) => downloadImportLog(input.batchId)),

  // Get all import batches (history)
  getImportBatches: publicProcedure
    .query(() => getImportBatches()),

  // Get contacts with pagination
  getContacts: publicProcedure
    .input(z.object({
      page: z.number().int().positive().optional().default(1),
      limit: z.number().int().positive().max(100).optional().default(50)
    }))
    .query(({ input }) => getContacts(input.page, input.limit)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();