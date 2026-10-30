import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthAttempt, isSameOrigin } from "@/lib/auth";
import { emailOtpDeliveryConfigured, issueEmailOtp } from "@/lib/email-otp";
import { errorResponse, readJson } from "@/lib/http";
import { pool } from "@/lib/db";

const schema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Cross-origin request rejected.", 403);
  const body = await readJson(request);
  if (!body) return errorResponse("Invalid verification request.", 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("Enter the email address used to register.", 400);
  if (!(await consumeAuthAttempt(parsed.data.email))) {
    return errorResponse("Too many requests. Try again in 15 minutes.", 429);
  }
  if (!emailOtpDeliveryConfigured()) {
    return errorResponse("Customer email verification is not configured.", 503);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: string }>(
      `SELECT "id" FROM "AppUser" WHERE "email"=$1 AND "role"='CUSTOMER'
         AND "emailVerifiedAt" IS NULL AND "status"='ACTIVE' FOR UPDATE`,
      [parsed.data.email],
    );
    if (!user.rows[0]) {
      await client.query("ROLLBACK");
      return errorResponse("No unverified account was found for that email.", 404);
    }
    await issueEmailOtp(client, user.rows[0].id, parsed.data.email);
    await client.query("COMMIT");
    return NextResponse.json({ message: "A new verification code was sent." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
