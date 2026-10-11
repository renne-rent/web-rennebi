import { appendRow, deleteRow, getRows, updateRow } from "@/lib/googleSheets";
import type { Keuangan } from "@/lib/types";
import { requireSession } from "@/lib/auth";
import { upsertArchivedRecord } from "@/lib/archive";
import { NextResponse } from "next/server";

function isCurrentMonth(dateValue: string) {
  return /^\d{4}-\d{2}$/.test(dateValue.slice(0, 7)) && dateValue.slice(0, 7) === new Date().toISOString().slice(0, 7);
}

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const rows = await getRows<Keuangan>("keuangan");
    return NextResponse.json(rows.filter((row) => isCurrentMonth(row.tanggal)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengambil keuangan" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let archived = false;
  try {
    const payload = await request.json() as Keuangan;
    await upsertArchivedRecord("archive_keuangan", "id_transaksi", payload.id_transaksi, payload);
    archived = true;
    const result = await appendRow<Keuangan>("keuangan", payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menambah transaksi";
    return NextResponse.json({
      error: archived ? `Transaksi sudah masuk Arsip, tetapi gagal ditampilkan pada daftar Keuangan: ${message}` : message,
    }, { status: archived ? 502 : 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let transactionUpdated = false;
  try {
    const { id_transaksi, ...payload } = await request.json();
    if (!id_transaksi) {
      return NextResponse.json({ error: "id_transaksi wajib diisi" }, { status: 400 });
    }

    const result = await updateRow<Keuangan>("keuangan", "id_transaksi", id_transaksi, payload);
    transactionUpdated = true;
    await upsertArchivedRecord("archive_keuangan", "id_transaksi", id_transaksi, { ...payload, id_transaksi });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengubah transaksi";
    return NextResponse.json({
      error: transactionUpdated ? `Transaksi sudah diperbarui, tetapi Arsip gagal disinkronkan: ${message}` : message,
    }, { status: transactionUpdated ? 502 : 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { id_transaksi } = await request.json();
    if (!id_transaksi) {
      return NextResponse.json({ error: "id_transaksi wajib diisi" }, { status: 400 });
    }

    const result = await deleteRow("keuangan", "id_transaksi", id_transaksi).catch((error) => {
      if (error instanceof Error && error.message.endsWith(": No results found")) return null;
      throw error;
    });
    const archivedDelete = await deleteRow("archive_keuangan", "id_transaksi", id_transaksi).catch((error) => {
      if (error instanceof Error && error.message.endsWith(": No results found")) return null;
      throw error;
    });
    if (!result && !archivedDelete) {
      return NextResponse.json({ error: `Transaksi dengan ID ${id_transaksi} tidak ditemukan` }, { status: 404 });
    }
    return NextResponse.json(result ?? archivedDelete ?? { deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus transaksi" }, { status: 500 });
  }
}
