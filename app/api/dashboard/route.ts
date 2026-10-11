import { requireSession } from "@/lib/auth";
import { mergeArchiveRows } from "@/lib/archive";
import { getRows } from "@/lib/googleSheets";
import type { ArchiveBooking, ArchiveKeuangan, Booking, Keuangan, Mobil } from "@/lib/types";
import { NextResponse } from "next/server";

function isCurrentMonth(dateValue: string) {
  return /^\d{4}-\d{2}$/.test(dateValue.slice(0, 7))
    && dateValue.slice(0, 7) === new Date().toISOString().slice(0, 7);
}

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const [mobil, bookings, transactions, archivedBookings, archivedTransactions] = await Promise.all([
      getRows<Mobil>("mobil"),
      getRows<Booking>("booking"),
      getRows<Keuangan>("keuangan"),
      getRows<ArchiveBooking>("archive_booking"),
      getRows<ArchiveKeuangan>("archive_keuangan"),
    ]);

    return NextResponse.json({
      mobil,
      booking: bookings.filter((item) => isCurrentMonth(item.created_at || item.tgl_mulai)),
      keuangan: transactions.filter((item) => isCurrentMonth(item.tanggal)),
      arsipBooking: mergeArchiveRows(
        archivedBookings,
        bookings,
        "id_booking",
        (item) => item.created_at || item.tgl_mulai || "",
      ),
      arsipKeuangan: mergeArchiveRows(
        archivedTransactions,
        transactions,
        "id_transaksi",
        (item) => item.tanggal || "",
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data dashboard" },
      { status: 500 },
    );
  }
}
