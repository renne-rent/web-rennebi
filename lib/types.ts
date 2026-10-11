export type MobilStatus = "Tersedia" | "Disewa" | "Maintenance";
export type BookingStatus = "Aktif" | "Selesai" | "Terjadwal" | "Dibatalkan";
export type PembayaranStatus = "Lunas" | "DP" | "Menunggu" | "Dibatalkan";

export interface Mobil {
  id_mobil: string;
  nama_mobil: string;
  plat_nomor: string;
  tipe_mobil: string;
  status_mobil: MobilStatus;
  harga_per_hari: number;
}

export interface Booking {
  id_booking: string;
  id_mobil: string;
  nama_penyewa: string;
  no_hp: string;
  tgl_mulai: string;
  tgl_selesai: string;
  durasi_hari: number;
  jenis_layanan: string;
  total_biaya: number;
  status_pembayaran: PembayaranStatus;
  status_sewa: BookingStatus;
  created_at: string;
}

export interface ArchiveBooking extends Booking {
  archived_at: string;
}

export interface Keuangan {
  id_transaksi: string;
  id_booking: string;
  tanggal: string;
  tipe_transaksi: "Pemasukan" | "Pengeluaran";
  kategori: string;
  jumlah: number;
  keterangan: string;
}

export interface ArchiveKeuangan extends Keuangan {
  archived_at: string;
}

export interface DashboardStats {
  mobilAktif: number;
  mobilTersedia: number;
  mobilDisewa: number;
  mobilMaintenance: number;
  bookingAktif: number;
  totalPemasukan: number;
  totalPengeluaran: number;
  labaBersih: number;
}

export interface ApiError {
  error: string;
}
