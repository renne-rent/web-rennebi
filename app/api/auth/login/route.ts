import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/lib/auth";
import { getRows } from "@/lib/googleSheets";
import { NextResponse } from "next/server";

interface SheetUser {
  username: string;
  password: string;
  nama?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json({ error: "Username dan password wajib diisi." }, { status: 400 });
    }

    const users = await getRows<SheetUser>("users");
    const user = users.find((entry) => entry.username === username && entry.password === password);
    if (!user) {
      return NextResponse.json({ error: "Username atau password tidak valid." }, { status: 401 });
    }

    const response = NextResponse.json({ authenticated: true, name: user.nama ?? user.username });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.username), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memproses login." }, { status: 500 });
  }
}
