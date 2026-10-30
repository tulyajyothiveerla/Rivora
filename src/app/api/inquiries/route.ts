import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  city: z.string().trim().min(2).max(80),
  community: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
  consent: z.literal("true"),
  website: z.string().max(0).optional().default(""),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "The enquiry service is not configured yet." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    throw error;
  }

  const result = inquirySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Please check the enquiry details and consent." },
      { status: 400 },
    );
  }

  await pool.query(
    `INSERT INTO "ContactInquiry"
      ("name", "email", "city", "community", "message", "consent")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      result.data.name,
      result.data.email,
      result.data.city,
      result.data.community || null,
      result.data.message || null,
      true,
    ],
  );

  return NextResponse.json(
    { message: "Thank you. Your enquiry is with our team." },
    { status: 201 },
  );
}
