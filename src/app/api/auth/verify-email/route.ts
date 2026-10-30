import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthAttempt, createSession, isSameOrigin } from "@/lib/auth";
import { hashEmailOtp } from "@/lib/email-otp";
import { errorResponse, readJson } from "@/lib/http";
import { pool } from "@/lib/db";

const schema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Cross-origin request rejected.", 403);
  const body = await readJson(request);
  if (!body) return errorResponse("Invalid verification request.", 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("Enter the six-digit verification code.", 400);
  if (!(await consumeAuthAttempt(parsed.data.email))) {
    return errorResponse("Too many verification attempts. Try again in 15 minutes.", 429);
  }

  const client = await pool.connect();
  let verifiedUser: {
    id: string; memberId: string; name: string; email: string; role: "CUSTOMER";
    communityId: string | null;
  } | undefined;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      userId: string; codeHash: string; attempts: number; expiresAt: Date;
    }>(
      `SELECT v."userId",v."codeHash",v."attempts",v."expiresAt"
       FROM "EmailVerification" v JOIN "AppUser" u ON u."id"=v."userId"
       WHERE u."email"=$1 AND u."emailVerifiedAt" IS NULL AND u."status"='ACTIVE'
       FOR UPDATE OF v`,
      [parsed.data.email],
    );
    const verification = rows[0];
    if (!verification || verification.attempts >= 5 || new Date(verification.expiresAt) <= new Date()) {
      await client.query("ROLLBACK");
      return errorResponse("That code is invalid or expired. Request a new one.", 400);
    }
    const expected = Buffer.from(verification.codeHash, "utf8");
    const actual = Buffer.from(hashEmailOtp(parsed.data.code), "utf8");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await client.query(
        `UPDATE "EmailVerification" SET "attempts"="attempts"+1,"updatedAt"=CURRENT_TIMESTAMP
         WHERE "userId"=$1`,
        [verification.userId],
      );
      await client.query("COMMIT");
      return errorResponse("That code is incorrect. Check it and try again.", 400);
    }
    const result = await client.query(
      `UPDATE "AppUser" SET "emailVerifiedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1 AND "emailVerifiedAt" IS NULL
       RETURNING "id","memberId","name","email","role","communityId"::text AS "communityId"`,
      [verification.userId],
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return errorResponse("This account has already been verified.", 409);
    }
    verifiedUser = result.rows[0];
    await client.query(`DELETE FROM "EmailVerification" WHERE "userId"=$1`, [verification.userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (!verifiedUser) return errorResponse("Email verification could not be completed.", 500);
  await createSession(verifiedUser);
  return NextResponse.json({ user: verifiedUser, message: "Your email is verified. Welcome to RIVORA." });
}
