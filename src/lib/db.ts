import { Pool, types } from "pg";

const globalForDb = globalThis as typeof globalThis & { rivoraPool?: Pool };

types.setTypeParser(1082, (value) => value);

export const pool =
  globalForDb.rivoraPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.rivoraPool = pool;
