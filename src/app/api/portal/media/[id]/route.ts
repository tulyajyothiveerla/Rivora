import { NextResponse } from "next/server";
import { getSessionUser, hasRole } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this image." }, { status: 401 });
  const { id } = await context.params;
  const result = await pool.query<{
    id: string;
    ownerId: string;
    visibility: string;
    contentType: string;
    data: Buffer;
    imageUrl: string;
  }>(
    `SELECT m."id",m."ownerId",m."visibility",m."contentType",m."data",
       '/api/portal/media/' || m."id" AS "imageUrl"
     FROM "MediaAsset" m WHERE m."id"=$1`,
    [id],
  );
  const media = result.rows[0];
  if (!media) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  let allowed = hasRole(user, "ADMIN") || media.ownerId === user.id;
  if (!allowed && media.visibility === "MEMBERS" && user.role === "CUSTOMER") {
    const membership = await pool.query(
      `SELECT 1 FROM "Subscription" WHERE "userId"=$1 AND "status"='ACTIVE'
       AND ("endsAt" IS NULL OR "endsAt">CURRENT_TIMESTAMP) LIMIT 1`,
      [user.id],
    );
    allowed = Boolean(membership.rowCount);
  }
  if (!allowed && media.visibility === "PRIVATE" && user.role === "CUSTOMER") {
    const proof = await pool.query(
      `SELECT 1 FROM "ServiceJob" j JOIN "Booking" b ON b."id"=j."bookingId"
       WHERE b."userId"=$1 AND j."workerId"=$2 AND j."proofUrls" @> ARRAY[$3]::text[]
       LIMIT 1`,
      [user.id, media.ownerId, media.imageUrl],
    );
    allowed = Boolean(proof.rowCount);
  }
  if (!allowed) return NextResponse.json({ error: "You cannot view this image." }, { status: 403 });

  return new NextResponse(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(media.data.length),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
