import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  sqlitePragmasApplied?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Configures SQLite production pragmas once per process:
 * - WAL mode improves read/write concurrency under Next.js routes.
 * - busy_timeout avoids transient SQLITE_BUSY errors under concurrent bookings.
 * - synchronous = NORMAL gives strong durability with high write throughput in WAL mode.
 * - foreign_keys = ON enforces relational integrity at the SQLite engine layer.
 */
async function ensureSqlitePragmas() {
  if (globalForPrisma.sqlitePragmasApplied || !process.env.DATABASE_URL) return;
  globalForPrisma.sqlitePragmasApplied = true;
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
    await prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL;");
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");
  } catch (err) {
    console.warn("[prisma] Could not apply SQLite pragmas:", err);
  }
}

void ensureSqlitePragmas();
