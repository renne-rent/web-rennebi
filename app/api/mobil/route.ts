import { appendRow, deleteRow, getRows, updateRow } from "@/lib/googleSheets";
import type { Mobil } from "@/lib/types";
import { requireSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const rows = await getRows<Mobil>("mobil");
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengambil mobil" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const payload = await request.json();
    const result = await appendRow<Mobil>("mobil", payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menambah mobil" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { id_mobil, ...payload } = await request.json();
    if (!id_mobil) {
      return NextResponse.json({ error: "id_mobil wajib diisi" }, { status: 400 });
    }

    const result = await updateRow<Mobil>("mobil", "id_mobil", id_mobil, payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengubah mobil" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { id_mobil } = await request.json();
    if (!id_mobil) {
      return NextResponse.json({ error: "id_mobil wajib diisi" }, { status: 400 });
    }

    const result = await deleteRow("mobil", "id_mobil", id_mobil);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus mobil" }, { status: 500 });
  }
}
