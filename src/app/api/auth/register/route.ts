import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthAttempt, isSameOrigin } from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";
import { pool } from "@/lib/db";
import { emailOtpDeliveryConfigured, issueEmailOtp } from "@/lib/email-otp";
import { platformFeatureEnabled } from "@/lib/platform-settings";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  phone: z.string().trim().max(30).optional().default(""),
  city: z.string().trim().min(2).max(80),
  communityRequest: z.string().trim().max(120).optional().default(""),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Cross-origin request rejected.", 403);
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
    return errorResponse("Account registration is not configured.", 503);
  }
  if (!emailOtpDeliveryConfigured()) {
    return errorResponse("Customer email verification is not configured.", 503);
  }
  if (!(await platformFeatureEnabled("registrationEnabled"))) {
    return errorResponse("New customer registration is currently closed.", 403);
  }
  const body = await readJson(request);
  if (!body) return errorResponse("Invalid JSON body.", 400);
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Please check your details. Passwords must be at least 12 characters.", 400);
  if (!(await consumeAuthAttempt(parsed.data.email))) {
    return errorResponse("Too many requests for this email. Try again in 15 minutes.", 429);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const client = await pool.connect();
  let createdUser: {
    id: string; memberId: string; name: string; email: string; role: "CUSTOMER";
    communityId: string | null; city: string; communityRequest: string | null;
  } | undefined;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      id: string; memberId: string; name: string; email: string; role: "CUSTOMER";
      communityId: string | null; city: string; communityRequest: string | null;
    }>(
      `INSERT INTO "AppUser" ("name", "email", "phone", "passwordHash", "city", "communityRequest")
       VALUES ($1, $2, $3, $4, $5, NULLIF($6,''))
       RETURNING "id", "memberId", "name", "email", "role", "city",
         "communityRequest", "communityId"::text AS "communityId"`,
      [parsed.data.name, parsed.data.email, parsed.data.phone || null, passwordHash,
        parsed.data.city, parsed.data.communityRequest],
    );
    await client.query(
      `INSERT INTO "ClubProfile" ("userId") VALUES ($1)`,
      [rows[0].id],
    );
    await issueEmailOtp(client, rows[0].id, rows[0].email);
    createdUser = rows[0];
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return errorResponse("An account with this email already exists.", 409);
    }
    throw error;
  } finally {
    client.release();
  }
  if (!createdUser) return errorResponse("The account could not be created.", 500);
  return NextResponse.json({
    verificationRequired: true,
    email: createdUser.email,
    message: "Enter the six-digit verification code sent to your email.",
  }, { status: 201 });
}
