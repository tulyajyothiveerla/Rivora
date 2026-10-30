import "server-only";

import { createHash, randomInt } from "node:crypto";
import type { PoolClient } from "pg";

export function emailOtpDeliveryConfigured() {
  return process.env.NODE_ENV !== "production" ||
    Boolean(process.env.EMAIL_OTP_WEBHOOK_URL && process.env.EMAIL_OTP_WEBHOOK_SECRET);
}

export async function issueEmailOtp(client: PoolClient, userId: string, email: string) {
  const code = String(randomInt(100000, 1000000));
  const codeHash = createHash("sha256").update(code).digest("hex");
  await client.query(
    `INSERT INTO "EmailVerification" ("userId","codeHash","expiresAt","attempts","updatedAt")
     VALUES ($1,$2,CURRENT_TIMESTAMP+INTERVAL '10 minutes',0,CURRENT_TIMESTAMP)
     ON CONFLICT ("userId") DO UPDATE
       SET "codeHash"=EXCLUDED."codeHash","expiresAt"=EXCLUDED."expiresAt",
         "attempts"=0,"updatedAt"=CURRENT_TIMESTAMP`,
    [userId, codeHash],
  );

  const webhookUrl = process.env.EMAIL_OTP_WEBHOOK_URL;
  const secret = process.env.EMAIL_OTP_WEBHOOK_SECRET;
  if (webhookUrl && secret) {
    const target = new URL(webhookUrl);
    if (target.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_OTP_WEBHOOK_URL must use HTTPS in production.");
    }
    const response = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: email,
        subject: "Verify your RIVORA account",
        text: `Your RIVORA verification code is ${code}. It expires in 10 minutes.`,
        code,
        expiresInMinutes: 10,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Email delivery endpoint returned HTTP ${response.status}.`);
    }
  } else if (process.env.NODE_ENV === "development") {
    console.info(`[RIVORA local OTP] ${email}: ${code}`);
  } else {
    throw new Error("Configure EMAIL_OTP_WEBHOOK_URL and EMAIL_OTP_WEBHOOK_SECRET.");
  }
}

export function hashEmailOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
