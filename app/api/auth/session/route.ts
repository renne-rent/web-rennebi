import { hasValidSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({ authenticated: await hasValidSession() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memeriksa sesi." }, { status: 500 });
  }
}
