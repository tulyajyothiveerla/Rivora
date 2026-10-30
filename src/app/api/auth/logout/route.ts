import { NextResponse } from "next/server";
import { isSameOrigin, revokeSession } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }
  await revokeSession();
  return NextResponse.json({ message: "Signed out." });
}
