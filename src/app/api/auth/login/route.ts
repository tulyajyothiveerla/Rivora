import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthAttempt, createSession, isSameOrigin } from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";
import { pool } from "@/lib/db";

const loginSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Cross-origin request rejected.", 403);
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
    return errorResponse("Sign-in is not configured.", 503);
  }
  const body = await readJson(request);
  if (!body) return errorResponse("Invalid JSON body.", 400);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid email or password.", 400);
  if (!(await consumeAuthAttempt(parsed.data.email))) {
    return errorResponse("Too many sign-in attempts. Try again in 15 minutes.", 429);
  }

  const { rows } = await pool.query<{
    id: string; memberId: string; name: string; email: string; role: "CUSTOMER" | "WORKER" | "ADMIN";
    communityId: string | null; passwordHash: string; emailVerifiedAt: Date | null;
  }>(
    `SELECT "id", "memberId", "name", "email", "role", "communityId"::text AS "communityId",
       "passwordHash","emailVerifiedAt"
     FROM "AppUser" WHERE "email" = $1 AND "status" = 'ACTIVE'`,
    [parsed.data.email],
  );
  const candidate = rows[0];
  const dummyHash = await getDummyHash();
  const valid = await bcrypt.compare(parsed.data.password, candidate?.passwordHash ?? dummyHash);
  if (!candidate || !valid) return errorResponse("Invalid email or password.", 401);
  if (!candidate.emailVerifiedAt) {
    return errorResponse("Verify your email before signing in. Request a new code from the registration page.", 403);
  }

  const user = {
    id: candidate.id,
    memberId: candidate.memberId,
    name: candidate.name,
    email: candidate.email,
    role: candidate.role,
    communityId: candidate.communityId,
  };
  await createSession(user);
  return NextResponse.json({ user });
}

let dummyHashPromise: Promise<string> | undefined;

function getDummyHash() {
  dummyHashPromise ??= bcrypt.hash("not-a-real-rivora-account-password", 12);
  return dummyHashPromise;
}
