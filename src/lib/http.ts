import { NextResponse } from "next/server";

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}
