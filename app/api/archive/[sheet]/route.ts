import { deleteRow, getRows } from "@/lib/googleSheets";
import type { SheetName } from "@/lib/googleSheets";
import { requireSession } from "@/lib/auth";
import { mergeArchiveRows } from "@/lib/archive";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sheet: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { sheet } = await params;
    if (sheet !== "booking" && sheet !== "keuangan") {
      return NextResponse.json({ error: "Sheet arsip tidak valid" }, { status: 400 });
    }

    const [archived, active] = await Promise.all([
      getRows<Record<string, unknown>>(sheet === "booking" ? "archive_booking" : "archive_keuangan"),
      getRows<Record<string, unknown>>(sheet),
    ]);
    const rows = sheet === "booking"
      ? mergeArchiveRows(archived, active, "id_booking", (row) => String(row.created_at ?? row.tgl_mulai ?? ""))
      : mergeArchiveRows(archived, active, "id_transaksi", (row) => String(row.tanggal ?? ""));
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengambil arsip" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ sheet: string }> }) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { sheet } = await params;
    if (sheet !== "booking" && sheet !== "keuangan") {
      return NextResponse.json({ error: "Sheet arsip tidak valid" }, { status: 400 });
    }
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
    }

    const archiveSheet = sheet === "booking" ? "archive_booking" : "archive_keuangan";
    const idColumn = sheet === "booking" ? "id_booking" : "id_transaksi";
    const targetSheets: SheetName[] = [sheet, archiveSheet];
    for (const targetSheet of targetSheets) {
      await deleteRow(targetSheet, idColumn, id).catch((error) => {
        if (!(error instanceof Error) || !error.message.endsWith(": No results found")) {
          throw error;
        }
      });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus arsip permanen" }, { status: 500 });
  }
}
