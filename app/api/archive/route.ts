import { getRows } from "@/lib/googleSheets";
import { upsertArchivedRecord } from "@/lib/archive";
import type { Booking, Keuangan } from "@/lib/types";
import { requireSession } from "@/lib/auth";
import { NextResponse } from "next/server";

async function archiveRecord<T extends object>(sourceSheet: "booking" | "keuangan", id: string) {
  const rows = await getRows<T>(sourceSheet);
  const idField = sourceSheet === "booking" ? "id_booking" : "id_transaksi";
  const record = rows.find((row) => String((row as Record<string, unknown>)[idField] ?? "") === id);

  if (!record) {
    return { ok: false, error: `Data dengan ID ${id} tidak ditemukan di ${sourceSheet}` };
  }

  const archiveSheet = sourceSheet === "booking" ? "archive_booking" : "archive_keuangan";
  await upsertArchivedRecord(archiveSheet, idField, id, record);
  return { ok: true };
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { sourceSheet, archiveSheet, id } = await request.json();

    if (!sourceSheet || !archiveSheet || !id) {
      return NextResponse.json({ error: "sourceSheet, archiveSheet, dan id wajib diisi" }, { status: 400 });
    }

    if (sourceSheet === "booking") {
      const result = await archiveRecord<Booking>("booking", id);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    if (sourceSheet === "keuangan") {
      const result = await archiveRecord<Keuangan>("keuangan", id);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Sheet sumber tidak valid" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengarsipkan data" }, { status: 500 });
  }
}
