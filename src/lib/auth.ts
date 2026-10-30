import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { pool } from "@/lib/db";

export const SESSION_COOKIE = "rivora_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type Role = "CUSTOMER" | "WORKER" | "ADMIN";

export type SessionUser = {
  id: string;
  memberId: string;
  name: string;
  email: string;
  role: Role;
  communityId: string | null;
  permissions?: string[];
};

function getSessionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const token = await new SignJWT({ role: user.role, sid: id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionKey());

  await pool.query(
    `INSERT INTO "AuthSession" ("id", "userId", "expiresAt") VALUES ($1, $2, $3)`,
    [id, user.id, expiresAt],
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload;
  try {
    ({ payload } = await jwtVerify(token, getSessionKey()));
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string" ||
    !["CUSTOMER", "WORKER", "ADMIN"].includes(String(payload.role))
  ) {
    return null;
  }

  const { rows } = await pool.query<SessionUser>(
    `SELECT u."id", u."memberId", u."name", u."email", u."role",
            u."communityId"::text AS "communityId",
            (SELECT COALESCE(array_agg(p."scope"), ARRAY[]::text[])
             FROM "StaffPermission" p WHERE p."userId"=u."id") AS "permissions"
     FROM "AuthSession" s
     JOIN "AppUser" u ON u."id" = s."userId"
     WHERE s."id" = $1 AND s."userId" = $2
       AND s."expiresAt" > CURRENT_TIMESTAMP
       AND u."status" = 'ACTIVE'`,
    [payload.sid, payload.sub],
  );
  const user = rows[0] ?? null;
  if (user) {
    await pool.query(
      `UPDATE "Subscription" SET "status"='EXPIRED',"updatedAt"=CURRENT_TIMESTAMP
       WHERE "userId"=$1 AND "status"='ACTIVE' AND "endsAt"<=CURRENT_TIMESTAMP`,
      [user.id],
    );
  }
  return user;
}

export async function revokeSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSessionKey());
      if (typeof payload.sid === "string") {
        await pool.query('DELETE FROM "AuthSession" WHERE "id" = $1', [payload.sid]);
      }
    } catch {
      // An invalid token has no valid session to revoke.
    }
  }
  (await cookies()).delete(SESSION_COOKIE);
}

export function hasRole(user: SessionUser, ...roles: Role[]) {
  return roles.includes(user.role);
}

export function hasPermission(user: SessionUser, scope: string) {
  return user.role === "ADMIN" || Boolean(user.permissions?.includes(scope));
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function consumeAuthAttempt(email: string) {
  const key = createHash("sha256").update(email).digest("hex");
  const { rows } = await pool.query<{ attempts: number }>(
    `INSERT INTO "AuthRateLimit" AS rate_limit ("key", "attempts")
     VALUES ($1, 1)
     ON CONFLICT ("key") DO UPDATE
       SET "attempts" = CASE
             WHEN rate_limit."windowStartedAt" < CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN 1
               ELSE LEAST(rate_limit."attempts" + 1, 9)
           END,
           "windowStartedAt" = CASE
             WHEN rate_limit."windowStartedAt" < CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN CURRENT_TIMESTAMP
             ELSE rate_limit."windowStartedAt"
           END,
           "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "attempts"`,
    [key],
  );
  return rows[0].attempts <= 8;
}
