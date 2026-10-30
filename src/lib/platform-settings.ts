import "server-only";

import { pool } from "@/lib/db";

export async function platformFeatureEnabled(key: string) {
  const { rows } = await pool.query<{ value: boolean }>(
    `SELECT "value" #>> '{}' = 'true' AS "value" FROM "PlatformSetting" WHERE "key"=$1`,
    [key],
  );
  return rows[0]?.value ?? true;
}
