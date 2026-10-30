import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before running database migrations.");
}

const migrationFiles = (await readdir(new URL("../database/migrations/", import.meta.url)))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const pool = new Pool({ connectionString });

try {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_RivoraMigrations" (
        "name" TEXT PRIMARY KEY,
        "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migrationName of migrationFiles) {
      await client.query("BEGIN");
      try {
        const applied = await client.query(
          'SELECT 1 FROM "_RivoraMigrations" WHERE "name" = $1',
          [migrationName],
        );

        if (applied.rowCount === 0) {
          const migrationSql = await readFile(
            new URL(`../database/migrations/${migrationName}`, import.meta.url),
            "utf8",
          );
          await client.query(migrationSql);
          await client.query(
            'INSERT INTO "_RivoraMigrations" ("name") VALUES ($1)',
            [migrationName],
          );
          console.log(`Applied ${migrationName}`);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log("Database is up to date.");
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
