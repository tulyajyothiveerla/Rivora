import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser, hasRole, isSameOrigin } from "@/lib/auth";
import { pool } from "@/lib/db";

const MAX_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return error("Cross-origin request rejected.", 403);
  const user = await getSessionUser();
  if (!user || !hasRole(user, "CUSTOMER", "WORKER", "ADMIN")) {
    return error("Sign in to upload member media.", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const use = formData.get("use");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size < 1 || file.size > MAX_BYTES) {
    return error("Choose a JPEG, PNG, or WebP image no larger than 5 MB.", 400);
  }
  if (use !== "proof" && use !== "listing") return error("Choose a valid upload purpose.", 400);
  if (use === "listing" && user.role !== "CUSTOMER") {
    return error("Only members can add marketplace images.", 403);
  }
  const data = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(file.type, data)) return error("The image contents do not match its file type.", 400);

  const id = randomUUID();
  const visibility = use === "listing" ? "MEMBERS" : "PRIVATE";
  await pool.query(
    `INSERT INTO "MediaAsset" ("id","ownerId","visibility","contentType","fileName","byteLength","data")
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, user.id, visibility, file.type, sanitizeFileName(file.name), data.length, data],
  );
  return NextResponse.json({ url: `/api/portal/media/${id}` }, { status: 201 });
}

function matchesSignature(type: string, data: Buffer) {
  if (type === "image/jpeg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (type === "image/png") return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP";
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.-]/g, "_").slice(-180) || "image";
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
