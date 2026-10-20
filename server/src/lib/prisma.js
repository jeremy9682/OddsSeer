/**
 * Prisma Client Instance
 * Singleton pattern to prevent multiple instances in development
 *
 * Only imported by the hybrid search pipeline and the explicit sync/embedding
 * CLIs. The default public search mode never loads this module.
 */

import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for ODDSSEER_SEARCH_MODE=hybrid and the sync/embedding commands');
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // Query logging stays off: queries carry user search text.
  log: [],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
