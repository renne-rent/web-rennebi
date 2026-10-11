import { requireSession } from "@/lib/auth";
import { upsertArchivedRecord } from "@/lib/archive";
import { appendRow, deleteRow, getRows, updateRow } from "@/lib/googleSheets";
import type { Booking, Keuangan, Mobil } from "@/lib/types";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

async function prepareBookingPayment(booking: Booking, paidAmount: number) {
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > Number(booking.total_biaya)) {
    throw new Error("Nominal pembayaran harus antara Rp 0 dan total biaya booking.");
  }
  if (booking.status_pembayaran === "Lunas" && paidAmount !== Number(booking.total_biaya)) {
    throw new Error("Booking berstatus Lunas harus memiliki nominal pembayaran sama dengan total biaya.");
  }

  const [transactions, archivedTransactions] = await Promise.all([
    getRows<Keuangan>("keuangan"),
    getRows<Keuangan>("archive_keuangan"),
  ]);
  const bookingTransactions = [...new Map(
    [...transactions, ...archivedTransactions].map((item) => [item.id_transaksi, item]),
  ).values()];
  const previousPayments = bookingTransactions
    .filter((item) => item.id_booking === booking.id_booking && item.tipe_transaksi === "Pemasukan")
    .reduce((sum, item) => sum + Number(item.jumlah || 0), 0);

  if (paidAmount < previousPayments) {
    throw new Error(`Nominal tidak boleh lebih kecil dari pembayaran yang sudah tercatat (${previousPayments}).`);
  }
  if (paidAmount === previousPayments) return null;

  const difference = paidAmount - previousPayments;
  const payment: Keuangan = {
    id_transaksi: `PAY-${createHash("sha256").update(`${booking.id_booking}:${paidAmount}`).digest("hex").slice(0, 12).toUpperCase()}`,
    id_booking: booking.id_booking,
    tanggal: new Date().toISOString().slice(0, 10),
    tipe_transaksi: "Pemasukan",
    kategori: "Pembayaran Booking",
    jumlah: difference,
    keterangan: `Pembayaran booking ${booking.id_booking} - ${booking.nama_penyewa}`,
  };

  if (bookingTransactions.some((item) => item.id_transaksi === payment.id_transaksi)) return null;
  return payment;
}

function isCurrentMonth(dateValue: string) {
  const date = dateValue.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(date) && date === new Date().toISOString().slice(0, 7);
}

async function syncCarAvailability(carId: string) {
  if (!carId) return;

  const [cars, bookings, archivedBookings] = await Promise.all([
    getRows<Mobil>("mobil"),
    getRows<Booking>("booking"),
    getRows<Booking>("archive_booking"),
  ]);
  const car = cars.find((item) => item.id_mobil === carId);
  if (!car) throw new Error(`Mobil dengan ID ${carId} tidak ditemukan saat memperbarui status.`);
  if (car.status_mobil === "Maintenance") return;

  const bookingsById = new Map<string, Booking>();
  [...archivedBookings, ...bookings].forEach((item) => bookingsById.set(item.id_booking, item));
  const hasOpenBooking = [...bookingsById.values()].some(
    (item) => item.id_mobil === carId && item.status_sewa !== "Selesai" && item.status_sewa !== "Dibatalkan",
  );
  const nextStatus = hasOpenBooking ? "Disewa" : "Tersedia";

  if (car.status_mobil !== nextStatus) {
    await updateRow<Mobil>("mobil", "id_mobil", carId, { status_mobil: nextStatus });
  }
}

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const rows = await getRows<Booking>("booking");
    return NextResponse.json(rows.filter((row) => isCurrentMonth(row.created_at || row.tgl_mulai)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengambil booking" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let bookingSaved = false;
  let bookingArchived = false;
  try {
    const { jumlah_dibayar = 0, ...payload } = await request.json() as Booking & { jumlah_dibayar?: number };
    const payment = await prepareBookingPayment(payload, Number(jumlah_dibayar));
    await upsertArchivedRecord("archive_booking", "id_booking", payload.id_booking, payload);
    bookingArchived = true;
    await appendRow<Booking>("booking", payload);
    bookingSaved = true;
    if (payment) {
      await upsertArchivedRecord("archive_keuangan", "id_transaksi", payment.id_transaksi, payment);
      await appendRow<Keuangan>("keuangan", payment);
    }
    await syncCarAvailability(payload.id_mobil);
    return NextResponse.json({ created: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menambah booking";
    return NextResponse.json({
      error: bookingSaved
        ? `Booking sudah tersimpan, tetapi data terkait atau status mobil gagal disinkronkan: ${message}`
        : bookingArchived
          ? `Booking sudah masuk Arsip, tetapi gagal ditampilkan pada daftar Booking: ${message}`
          : message,
    }, { status: bookingSaved || bookingArchived ? 502 : 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let bookingSaved = false;
  try {
    const { id_booking, jumlah_dibayar, ...payload } = await request.json() as Booking & { jumlah_dibayar?: number };
    if (!id_booking) {
      return NextResponse.json({ error: "id_booking wajib diisi" }, { status: 400 });
    }

    const previousBookings = await getRows<Booking>("booking");
    const previousCarId = previousBookings.find((item) => item.id_booking === id_booking)?.id_mobil;
    const booking = { ...payload, id_booking } as Booking;
    const payment = await prepareBookingPayment(booking, Number(jumlah_dibayar ?? 0));
    const result = await updateRow<Booking>("booking", "id_booking", id_booking, payload);
    bookingSaved = true;
    await upsertArchivedRecord("archive_booking", "id_booking", id_booking, booking);
    if (payment) {
      await upsertArchivedRecord("archive_keuangan", "id_transaksi", payment.id_transaksi, payment);
      await appendRow<Keuangan>("keuangan", payment);
    }
    if (previousCarId && previousCarId !== booking.id_mobil) {
      await syncCarAvailability(previousCarId);
    }
    await syncCarAvailability(booking.id_mobil);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengubah booking";
    return NextResponse.json({
      error: bookingSaved ? `Booking sudah diperbarui, tetapi arsip, transaksi, atau status mobil gagal disinkronkan: ${message}` : message,
    }, { status: bookingSaved ? 502 : 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { id_booking } = await request.json() as { id_booking?: string };
    if (!id_booking) {
      return NextResponse.json({ error: "id_booking wajib diisi" }, { status: 400 });
    }

    const [activeBookings, archivedBookings] = await Promise.all([
      getRows<Booking>("booking"),
      getRows<Booking>("archive_booking"),
    ]);
    const carId = [...activeBookings, ...archivedBookings].find((item) => item.id_booking === id_booking)?.id_mobil;
    const result = await deleteRow("booking", "id_booking", id_booking).catch((error) => {
      if (error instanceof Error && error.message.endsWith(": No results found")) return null;
      throw error;
    });
    const archivedDelete = await deleteRow("archive_booking", "id_booking", id_booking).catch((error) => {
      if (error instanceof Error && error.message.endsWith(": No results found")) return null;
      throw error;
    });
    if (!result && !archivedDelete) {
      return NextResponse.json({ error: `Booking dengan ID ${id_booking} tidak ditemukan` }, { status: 404 });
    }
    if (carId) await syncCarAvailability(carId);
    return NextResponse.json(result ?? archivedDelete ?? { deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus booking" }, { status: 500 });
  }
}
