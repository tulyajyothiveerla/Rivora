import bcrypt from "bcryptjs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
if (!connectionString || !adminEmail || !adminPassword ||
    adminPassword.length < 12 || Buffer.byteLength(adminPassword, "utf8") > 72) {
  throw new Error(
    "Set DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD (12-72 UTF-8 bytes) before seeding staff.",
  );
}

const pool = new Pool({ connectionString });
async function provisionStaff(email, password, name, role) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT "memberId", "role" FROM "AppUser" WHERE "email" = $1 FOR UPDATE`,
      [email],
    );
    if (existing.rows[0] && existing.rows[0].role !== role) {
      throw new Error(`${email} already belongs to a ${existing.rows[0].role} account; refusing to change its role.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = existing.rows[0]
      ? await client.query(
        `UPDATE "AppUser" SET "passwordHash"=$2,"status"='ACTIVE',"emailVerifiedAt"=CURRENT_TIMESTAMP,
           "updatedAt"=CURRENT_TIMESTAMP
         WHERE "email"=$1 RETURNING "memberId"`,
        [email, passwordHash],
      )
      : await client.query(
        `INSERT INTO "AppUser" ("name", "email", "passwordHash", "role","emailVerifiedAt")
         VALUES ($1, $2, $3, $4,CURRENT_TIMESTAMP) RETURNING "memberId"`,
        [name, email, passwordHash, role],
      );
    await client.query("COMMIT");
    return result.rows[0].memberId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  const memberId = await provisionStaff(adminEmail, adminPassword, "RIVORA Administrator", "ADMIN");
  console.log(`Admin account ready: ${adminEmail} (${memberId})`);

  const workerEmail = process.env.WORKER_EMAIL?.toLowerCase();
  const workerPassword = process.env.WORKER_PASSWORD;
  if (workerEmail || workerPassword) {
    if (!workerEmail || !workerPassword || workerPassword.length < 12 ||
        Buffer.byteLength(workerPassword, "utf8") > 72) {
      throw new Error("Set both WORKER_EMAIL and WORKER_PASSWORD (12-72 UTF-8 bytes).");
    }
    const workerMemberId = await provisionStaff(
      workerEmail, workerPassword, "RIVORA Field Professional", "WORKER",
    );
    console.log(`Worker account ready: ${workerEmail} (${workerMemberId})`);
  }
} finally {
  await pool.end();
}
