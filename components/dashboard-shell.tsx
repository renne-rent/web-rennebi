"use client";

import {
  Activity,
  Archive,
  ArrowUpRight,
  Car,
  Check,
  CreditCard,
  FileText,
  LogOut,
  Menu,
  Plus,
  Search,
  TrendingUp,
  XCircle,
  X,
} from "lucide-react";
import Image from "next/image";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ArchiveBooking, ArchiveKeuangan, Booking, DashboardStats, Keuangan, Mobil } from "@/lib/types";

const currency = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const formatNominalInput = (value: string | number) => {
  const digits = String(value).replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
};

const parseNominalInput = (value: FormDataEntryValue | null) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const calculateRentalDays = (startDate: string, endDate: string) => {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
};

const statusColors: Record<string, string> = {
  Tersedia: "#22c55e",
  Disewa: "#9c342e",
  Maintenance: "#f59e0b",
  Aktif: "#9c342e",
  Selesai: "#22c55e",
  Terjadwal: "#85817e",
  Dibatalkan: "#ef4444",
  Lunas: "#22c55e",
  DP: "#f59e0b",
  Menunggu: "#ef4444",
};

const defaultMobil: Partial<Mobil> = {
  nama_mobil: "",
  plat_nomor: "",
  tipe_mobil: "MPV",
  status_mobil: "Tersedia",
  harga_per_hari: 350000,
};

const defaultBooking: Partial<Booking> = {
  id_mobil: "M-001",
  nama_penyewa: "",
  no_hp: "",
  tgl_mulai: new Date().toISOString().slice(0, 10),
  tgl_selesai: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  durasi_hari: 1,
  jenis_layanan: "Lepas Kunci",
  total_biaya: 0,
  status_pembayaran: "Menunggu",
  status_sewa: "Terjadwal",
  created_at: new Date().toISOString(),
};

const serviceOptions = ["Lepas Kunci", "Dengan Sopir", "Antar Jemput Bandara", "Event", "Lainnya"] as const;

const defaultKeuangan: Partial<Keuangan> = {
  id_booking: "",
  tanggal: new Date().toISOString().slice(0, 10),
  tipe_transaksi: "Pengeluaran",
  kategori: "Sewa Mobil",
  jumlah: 0,
  keterangan: "",
};

const createId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? "Request gagal");
  }
  return payload as T;
}

function StatCard({ title, value, detail, icon, color }: { title: string; value: string; detail: string; icon: ReactNode; color: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}22)` }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</h3>
        </div>
        <div className="rounded-xl p-3 transition-transform duration-200 group-hover:scale-105" style={{ backgroundColor: `${color}18`, color }}>
          {icon}
        </div>
      </div>
      <p className="mt-4 flex items-center text-xs text-slate-500"><ArrowUpRight className="mr-1 h-3.5 w-3.5" /> {detail}</p>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Rental Ops</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">{action}</div>}
    </div>
  );
}

function DataTable({ children }: { children: ReactNode }) {
  return (
    <div
      className="data-table-scroll overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      role="region"
      aria-label="Tabel data, geser ke samping untuk melihat seluruh kolom"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function NominalInput({
  name,
  defaultValue,
  className,
  placeholder,
  label,
  helperText,
}: {
  name: string;
  defaultValue?: number;
  className: string;
  placeholder: string;
  label: string;
  helperText?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <input
        name={name}
        type="text"
        inputMode="numeric"
        defaultValue={formatNominalInput(defaultValue ?? "")}
        onChange={(event) => {
          event.currentTarget.value = formatNominalInput(event.currentTarget.value);
        }}
        className={className}
        placeholder={placeholder}
        required
        aria-label={label}
      />
      {helperText && <span className="text-xs font-normal text-slate-500">{helperText}</span>}
    </label>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const values = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.get("username"),
          password: values.get("password"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = String(payload.error ?? "");
        if (message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
          throw new Error("Layanan login sedang mencapai batas kuota Google Sheets API. Coba kembali setelah kuota tersedia atau hubungi administrator.");
        }
        throw new Error(message || "Username atau password tidak valid.");
      }
      onLogin();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login gagal. Silakan coba kembali.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen min-h-[100svh] items-center justify-center overflow-hidden bg-[#f1f0ee] px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red-900/[0.04] blur-3xl" />
      <section className="login-panel-enter relative w-full max-w-md rounded-2xl border border-[#ded9d5] bg-white p-6 shadow-[0_24px_70px_-36px_rgba(56,35,29,0.3)] sm:p-8">
        <Image src="/rennerent-logo.png" alt="Rennerent Rent Car" width={500} height={500} priority className="login-brand-enter mx-auto mb-3 h-auto w-32 sm:w-36" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Akses Akun</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Login Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Masuk menggunakan akun terdaftar.</p>
        {error && <div role="alert" aria-live="assertive" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</div>}
        <form onSubmit={handleSubmit} className="mt-6 dashboard-panel-enter">
          <label className="block text-sm font-medium text-slate-700" htmlFor="login-username">Username</label>
          <input id="login-username" name="username" autoComplete="username" required className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="login-password">Password</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          <button type="submit" disabled={submitting} className="mt-7 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
            {submitting ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function DashboardShell() {
  const [mobil, setMobil] = useState<Mobil[]>([]);
  const [booking, setBooking] = useState<Booking[]>([]);
  const [keuangan, setKeuangan] = useState<Keuangan[]>([]);
  const [arsipBooking, setArsipBooking] = useState<ArchiveBooking[]>([]);
  const [arsipKeuangan, setArsipKeuangan] = useState<ArchiveKeuangan[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [pullRefreshState, setPullRefreshState] = useState<"idle" | "pulling" | "ready" | "refreshing">("idle");
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; detail?: string } | null>(null);
  const [savingForm, setSavingForm] = useState<"mobil" | "booking" | "keuangan" | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showMobilForm, setShowMobilForm] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showKeuanganForm, setShowKeuanganForm] = useState(false);
  const [newMobilId, setNewMobilId] = useState("");
  const [newBookingId, setNewBookingId] = useState("");
  const [newKeuanganId, setNewKeuanganId] = useState("");
  const [archiveMonth, setArchiveMonth] = useState("");
  const [archiveDate, setArchiveDate] = useState("");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [editingMobil, setEditingMobil] = useState<Mobil | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editingKeuangan, setEditingKeuangan] = useState<Keuangan | null>(null);
  const [bookingStartDate, setBookingStartDate] = useState(String(defaultBooking.tgl_mulai));
  const [bookingEndDate, setBookingEndDate] = useState(String(defaultBooking.tgl_selesai));
  const [selectedService, setSelectedService] = useState<string>(String(defaultBooking.jenis_layanan));
  const [customService, setCustomService] = useState("");
  const touchStartY = useRef<number | null>(null);
  const touchPullDistance = useRef(0);
  const sidebarVisible = isDesktopLayout ? sidebarExpanded : mobileSidebarOpen;
  const showNotification = (type: "success" | "error", detail?: string) => {
    setNotification({ type, detail });
  };

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), notification.type === "success" ? 2600 : 4200);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const updateDesktopLayout = () => setIsDesktopLayout(desktopQuery.matches);
    updateDesktopLayout();
    desktopQuery.addEventListener("change", updateDesktopLayout);
    return () => desktopQuery.removeEventListener("change", updateDesktopLayout);
  }, []);

  const refreshData = async (showLoading = true): Promise<boolean> => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const data = await apiFetch<{
        mobil: Mobil[];
        booking: Booking[];
        keuangan: Keuangan[];
        arsipBooking: ArchiveBooking[];
        arsipKeuangan: ArchiveKeuangan[];
      }>("/api/dashboard");
      setMobil(data.mobil);
      setBooking(data.booking);
      setKeuangan(data.keuangan);
      setArsipBooking(data.arsipBooking);
      setArsipKeuangan(data.arsipKeuangan);
      return true;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data");
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void apiFetch<{ authenticated: boolean }>("/api/auth/session")
      .then(({ authenticated }) => {
        setIsAuthenticated(authenticated);
        if (!authenticated) setLoading(false);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Gagal memeriksa sesi login");
        setLoading(false);
      })
      .finally(() => {
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void apiFetch<{
      mobil: Mobil[];
      booking: Booking[];
      keuangan: Keuangan[];
      arsipBooking: ArchiveBooking[];
      arsipKeuangan: ArchiveKeuangan[];
    }>("/api/dashboard")
      .then((data) => {
        setMobil(data.mobil);
        setBooking(data.booking);
        setKeuangan(data.keuangan);
        setArsipBooking(data.arsipBooking);
        setArsipKeuangan(data.arsipKeuangan);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isAuthenticated]);

  const allBooking = useMemo(() => {
    const rows = new Map<string, Booking>();
    booking.forEach((item) => rows.set(item.id_booking, item));
    arsipBooking.forEach((item) => rows.set(item.id_booking, item));
    return [...rows.values()];
  }, [arsipBooking, booking]);

  const allKeuangan = useMemo(() => {
    const rows = new Map<string, Keuangan>();
    keuangan.forEach((item) => rows.set(item.id_transaksi, item));
    arsipKeuangan.forEach((item) => rows.set(item.id_transaksi, item));
    return [...rows.values()];
  }, [arsipKeuangan, keuangan]);

  const stats = useMemo<DashboardStats>(() => {
    const mobilAktif = mobil.length;
    const mobilTersedia = mobil.filter((item) => item.status_mobil === "Tersedia").length;
    const mobilDisewa = mobil.filter((item) => item.status_mobil === "Disewa").length;
    const mobilMaintenance = mobil.filter((item) => item.status_mobil === "Maintenance").length;
    const bookingAktif = booking.filter((item) => item.status_sewa === "Aktif").length;
    const totalPemasukan = allKeuangan.filter((item) => item.tipe_transaksi === "Pemasukan").reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
    const totalPengeluaran = allKeuangan.filter((item) => item.tipe_transaksi === "Pengeluaran").reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
    return {
      mobilAktif: mobilAktif,
      mobilTersedia,
      mobilDisewa,
      mobilMaintenance,
      bookingAktif,
      totalPemasukan,
      totalPengeluaran,
      labaBersih: totalPemasukan - totalPengeluaran,
    };
  }, [mobil, booking, allKeuangan]);

  const mobilChartData = useMemo(() => {
    return [
      { name: "Tersedia", value: stats.mobilTersedia },
      { name: "Disewa", value: stats.mobilDisewa },
      { name: "Maintenance", value: stats.mobilMaintenance },
    ];
  }, [stats]);

  const serviceChartData = useMemo(() => {
    const lookup = new Map<string, number>(serviceOptions.map((service) => [service, 0]));
    allBooking.forEach((item) => {
      const service = serviceOptions.includes(item.jenis_layanan as typeof serviceOptions[number])
        ? item.jenis_layanan
        : "Lainnya";
      lookup.set(service, (lookup.get(service) ?? 0) + 1);
    });
    return [...lookup.entries()].map(([name, total]) => ({ name, total }));
  }, [allBooking]);

  const monthlyChartData = useMemo(() => {
    const map = new Map<string, number>();
    allKeuangan.forEach((item) => {
      if (item.tipe_transaksi !== "Pemasukan") return;
      const month = new Date(`${item.tanggal}T00:00:00`).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
      map.set(month, (map.get(month) ?? 0) + Number(item.jumlah || 0));
    });
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }, [allKeuangan]);

  const navigationTabs = [
    { id: "overview", label: "Overview", icon: <Activity className="h-4 w-4" /> },
    { id: "mobil", label: "Mobil", icon: <Car className="h-4 w-4" /> },
    { id: "booking", label: "Booking", icon: <FileText className="h-4 w-4" /> },
    { id: "keuangan", label: "Keuangan", icon: <CreditCard className="h-4 w-4" /> },
    { id: "archive", label: "Arsip", icon: <Archive className="h-4 w-4" /> },
  ];

  const popularCars = useMemo(() => {
    const map = new Map<string, number>();
    allBooking.forEach((item) => {
      const count = map.get(item.id_mobil) ?? 0;
      map.set(item.id_mobil, count + 1);
    });
    return [...map.entries()]
      .map(([id, total]) => ({ id, total, name: mobil.find((car) => car.id_mobil === id)?.nama_mobil ?? id }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [allBooking, mobil]);

  const paymentsByBooking = useMemo(() => {
    const totals = new Map<string, number>();
    allKeuangan.forEach((item) => {
      if (item.tipe_transaksi === "Pemasukan" && item.id_booking) {
        totals.set(item.id_booking, (totals.get(item.id_booking) ?? 0) + Number(item.jumlah || 0));
      }
    });
    return totals;
  }, [allKeuangan]);

  const visibleArchiveBookings = useMemo(
    () => {
      const query = archiveSearch.trim().toLowerCase();

      return arsipBooking.filter((item) => {
        const bookingDate = item.created_at?.slice(0, 10) || item.tgl_mulai;
        const matchesDate = archiveDate
          ? bookingDate === archiveDate
          : !archiveMonth || bookingDate?.slice(0, 7) === archiveMonth;
        const matchesSearch = !query || [
          item.nama_penyewa,
          item.id_booking,
          item.id_mobil,
          item.no_hp,
          item.created_at,
          item.tgl_mulai,
          item.tgl_selesai,
          String(item.total_biaya),
        ].some((value) => String(value ?? "").toLowerCase().includes(query));

        return matchesDate && matchesSearch;
      });
    },
    [archiveDate, archiveMonth, archiveSearch, arsipBooking],
  );
  const visibleArchiveKeuangan = useMemo(
    () => {
      const query = archiveSearch.trim().toLowerCase();
      return arsipKeuangan.filter((item) => {
        const matchesDate = archiveDate
          ? item.tanggal === archiveDate
          : !archiveMonth || item.tanggal?.slice(0, 7) === archiveMonth;
        const matchesSearch = !query || [
          item.id_transaksi,
          item.id_booking,
          item.kategori,
          item.keterangan,
          item.tipe_transaksi,
          item.tanggal,
          String(item.jumlah),
        ].some((value) => String(value ?? "").toLowerCase().includes(query));

        return matchesDate && matchesSearch;
      });
    },
    [archiveDate, archiveMonth, archiveSearch, arsipKeuangan],
  );

  const handleSaveMobil = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Mobil = {
      id_mobil: String(form.get("id_mobil") ?? ""),
      nama_mobil: String(form.get("nama_mobil") ?? ""),
      plat_nomor: String(form.get("plat_nomor") ?? ""),
      tipe_mobil: String(form.get("tipe_mobil") ?? ""),
      status_mobil: String(form.get("status_mobil") ?? "Tersedia") as Mobil["status_mobil"],
      harga_per_hari: parseNominalInput(form.get("harga_per_hari")),
    };

    setSavingForm("mobil");
    setError("");
    try {
      if (editingMobil) {
        await apiFetch(`/api/mobil`, { method: "PATCH", body: JSON.stringify({ ...payload, id_mobil: editingMobil.id_mobil }) });
        await refreshData(false);
      } else {
        await apiFetch(`/api/mobil`, { method: "POST", body: JSON.stringify(payload) });
        setMobil((current) => [payload, ...current]);
      }
      setShowMobilForm(false);
      setEditingMobil(null);
      showNotification("success");
    } catch (saveError) {
      showNotification("error", saveError instanceof Error ? saveError.message : "Gagal menyimpan data mobil.");
    } finally {
      setSavingForm(null);
    }
  };

  const handleSaveBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedService === "Lainnya" && !customService.trim()) {
      showNotification("error", "Isi jenis layanan lainnya terlebih dahulu.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const payload: Booking = {
      id_booking: String(form.get("id_booking") ?? ""),
      id_mobil: String(form.get("id_mobil") ?? ""),
      nama_penyewa: String(form.get("nama_penyewa") ?? ""),
      no_hp: String(form.get("no_hp") ?? ""),
      tgl_mulai: String(form.get("tgl_mulai") ?? ""),
      tgl_selesai: String(form.get("tgl_selesai") ?? ""),
      durasi_hari: calculateRentalDays(String(form.get("tgl_mulai") ?? ""), String(form.get("tgl_selesai") ?? "")),
      jenis_layanan: selectedService === "Lainnya"
        ? customService.trim()
        : selectedService,
      total_biaya: parseNominalInput(form.get("total_biaya")),
      status_pembayaran: String(form.get("status_pembayaran") ?? "Menunggu") as Booking["status_pembayaran"],
      status_sewa: String(form.get("status_sewa") ?? "Terjadwal") as Booking["status_sewa"],
      created_at: editingBooking?.created_at ?? new Date().toISOString(),
    };
    const jumlahDibayar = parseNominalInput(form.get("jumlah_dibayar"));

    setSavingForm("booking");
    setError("");
    try {
      if (editingBooking) {
        await apiFetch(`/api/booking`, { method: "PATCH", body: JSON.stringify({ ...payload, id_booking: editingBooking.id_booking, jumlah_dibayar: jumlahDibayar }) });
      } else {
        await apiFetch(`/api/booking`, { method: "POST", body: JSON.stringify({ ...payload, jumlah_dibayar: jumlahDibayar }) });
      }
      await refreshData(false);
      setShowBookingForm(false);
      setEditingBooking(null);
      showNotification("success");
    } catch (saveError) {
      showNotification("error", saveError instanceof Error ? saveError.message : "Gagal menyimpan booking.");
    } finally {
      setSavingForm(null);
    }
  };

  const handleSaveKeuangan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Keuangan = {
      id_transaksi: String(form.get("id_transaksi") ?? ""),
      id_booking: editingKeuangan?.id_booking ?? "",
      tanggal: String(form.get("tanggal") ?? ""),
      tipe_transaksi: String(form.get("tipe_transaksi") ?? "Pengeluaran") as Keuangan["tipe_transaksi"],
      kategori: editingKeuangan?.kategori ?? "",
      jumlah: parseNominalInput(form.get("jumlah")),
      keterangan: String(form.get("keterangan") ?? ""),
    };

    setSavingForm("keuangan");
    setError("");
    try {
      if (editingKeuangan) {
        await apiFetch(`/api/keuangan`, { method: "PATCH", body: JSON.stringify({ ...payload, id_transaksi: editingKeuangan.id_transaksi }) });
      } else {
        await apiFetch(`/api/keuangan`, { method: "POST", body: JSON.stringify(payload) });
      }
      await refreshData(false);
      setShowKeuanganForm(false);
      setEditingKeuangan(null);
      showNotification("success");
    } catch (saveError) {
      showNotification("error", saveError instanceof Error ? saveError.message : "Gagal menyimpan transaksi keuangan.");
    } finally {
      setSavingForm(null);
    }
  };

  const handleDeleteArchive = async (sheet: "booking" | "keuangan", id: string) => {
    await runDataAction(async () => {
      await apiFetch(`/api/archive/${sheet}`, { method: "DELETE", body: JSON.stringify({ id }) });
    }, "Data arsip berhasil dihapus.");
  };

  const handleDeleteMobil = async (id: string) => {
    await runDataAction(async () => {
      await apiFetch(`/api/mobil`, { method: "DELETE", body: JSON.stringify({ id_mobil: id }) });
    }, "Data mobil berhasil dihapus.");
  };

  const handleDeleteBooking = async (id: string) => {
    await runDataAction(async () => {
      await apiFetch(`/api/booking`, { method: "DELETE", body: JSON.stringify({ id_booking: id }) });
    }, "Data booking berhasil dihapus.");
  };

  const handleDeleteKeuangan = async (id: string) => {
    await runDataAction(async () => {
      await apiFetch(`/api/keuangan`, { method: "DELETE", body: JSON.stringify({ id_transaksi: id }) });
    }, "Transaksi berhasil dihapus.");
  };

  async function runDataAction(action: () => Promise<void>, successMessage: string) {
    setError("");
    try {
      await action();
      await refreshData(false);
      showNotification("success", successMessage);
    } catch (actionError) {
      showNotification("error", actionError instanceof Error ? actionError.message : "Tindakan gagal diproses.");
    }
  }

  const handlePaymentStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (event.currentTarget.value !== "Lunas") return;
    const form = event.currentTarget.form;
    const paidField = form?.elements.namedItem("jumlah_dibayar");
    const totalField = form?.elements.namedItem("total_biaya");
    if (paidField instanceof HTMLInputElement && totalField instanceof HTMLInputElement) {
      paidField.value = formatNominalInput(totalField.value);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setIsAuthenticated(false);
      setMobil([]);
      setBooking([]);
      setKeuangan([]);
      setArsipBooking([]);
      setArsipKeuangan([]);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Gagal keluar dari akun");
    }
  };

  if (!authChecked) {
    return <div className="startup-loader"><span className="startup-spinner" /><p>Menyiapkan dashboard</p></div>;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => { setLoading(true); setIsAuthenticated(true); }} />;
  }

  return (
    <div
      className="min-h-screen bg-[#f1f0ee] text-slate-900 overscroll-y-contain"
      onTouchStart={(event) => {
        touchStartY.current = window.scrollY === 0 && !loading ? event.touches[0]?.clientY ?? null : null;
        touchPullDistance.current = 0;
      }}
      onTouchMove={(event) => {
        if (touchStartY.current === null || window.scrollY > 0) return;
        const distance = Math.max(0, event.touches[0].clientY - touchStartY.current);
        touchPullDistance.current = distance;
        if (distance > 0) setPullRefreshState(distance >= 72 ? "ready" : "pulling");
      }}
      onTouchEnd={() => {
        const shouldRefresh = touchPullDistance.current >= 72;
        touchStartY.current = null;
        touchPullDistance.current = 0;
        if (shouldRefresh) {
          setPullRefreshState("refreshing");
          void refreshData(false).finally(() => setPullRefreshState("idle"));
        } else {
          setPullRefreshState("idle");
        }
      }}
      onTouchCancel={() => {
        touchStartY.current = null;
        touchPullDistance.current = 0;
        setPullRefreshState("idle");
      }}
    >
      {notification && (
        <div className="pointer-events-none fixed inset-0 z-[100] grid place-items-center p-4">
          <section
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-4 rounded-2xl border p-5 shadow-2xl backdrop-blur-xl ${
              notification.type === "success"
                ? "border-emerald-400/40 bg-emerald-100/85"
                : "border-red-400/40 bg-red-100/85"
            }`}
            role={notification.type === "success" ? "status" : "alert"}
            aria-live={notification.type === "success" ? "polite" : "assertive"}
          >
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
              notification.type === "success" ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-700"
            }`}>
              {notification.type === "success"
                ? <Check className="h-6 w-6" strokeWidth={3} />
                : <XCircle className="h-6 w-6" strokeWidth={2.5} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                {notification.type === "success" ? "Data berhasil dimasukkan" : "Data gagal dimasukkan"}
              </p>
              {notification.detail && <p className="mt-1 break-words text-xs leading-5 text-slate-700">{notification.detail}</p>}
            </div>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => setNotification(null)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </section>
        </div>
      )}
      {mobileSidebarOpen && <button type="button" aria-label="Tutup navigasi" onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
      {pullRefreshState !== "idle" && (
        <div role="status" aria-live="polite" className="fixed left-1/2 top-3 z-[60] -translate-x-1/2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg">
          {pullRefreshState === "refreshing" ? "Memperbarui data..." : pullRefreshState === "ready" ? "Lepaskan untuk memperbarui" : "Tarik ke bawah untuk memperbarui"}
        </div>
      )}

      <aside id="dashboard-sidebar" aria-hidden={!sidebarVisible} style={{ transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)" }} className="fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[calc(100vw-3rem)] flex-col border-r border-[#e7e0dc] bg-[#f3f0ed] text-[#29231f] shadow-xl">
        <div className="flex min-h-32 shrink-0 items-center justify-between gap-3 border-b border-[#e7e0dc] px-5">
          <Image src="/rennerent-sidebar-logo.png" alt="Rennerent Rent Car" width={296} height={156} priority className="h-auto w-full max-w-40" />
          <button type="button" aria-label="Sembunyikan sidebar" onClick={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) setSidebarExpanded(false);
            else setMobileSidebarOpen(false);
          }} className="rounded-lg p-2 text-[#766b64] hover:bg-[#e7e0dc] hover:text-[#29231f]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Navigasi utama" className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#81756e]">Menu</p>
          {navigationTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => { setActiveTab(tab.id); setMobileSidebarOpen(false); }}
              className={`inline-flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-[#514843] hover:bg-[#e7e0dc] hover:text-[#29231f]"}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-t border-[#e7e0dc] p-3">
          <button onClick={() => void handleLogout()} className="inline-flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#514843] transition-colors hover:bg-[#e7e0dc] hover:text-[#762923]">
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        </div>
      </aside>

      {!sidebarVisible && (
        <button type="button" aria-label="Buka sidebar" aria-controls="dashboard-sidebar" onClick={() => {
          if (window.matchMedia("(min-width: 1024px)").matches) setSidebarExpanded(true);
          else setMobileSidebarOpen(true);
        }} className="fixed left-4 top-4 z-30 rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Menu className="h-5 w-5" />
        </button>
      )}

      <div className={`min-h-screen ${sidebarExpanded ? "lg:pl-72" : ""}`}>
      <main style={!sidebarVisible ? { paddingTop: "4rem" } : undefined} className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <div key={activeTab} className="min-w-0 dashboard-tab-content">

        {error && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p>{error}</p>
            <button type="button" aria-label="Tutup pesan kesalahan" onClick={() => setError("")} className="shrink-0 font-medium text-red-700 hover:text-red-900">Tutup</button>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
            <span className="startup-spinner" />
            <p className="text-sm font-medium">Menyiapkan dashboard</p>
          </div>
        ) : activeTab === "overview" ? (
          <>
            <SectionHeader title="Dashboard" subtitle="Ringkasan operasional dan performa Rennerent." />
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Total Armada" value={String(stats.mobilAktif)} detail={`${stats.mobilTersedia} tersedia`} icon={<Car className="h-5 w-5" />} color="#9c342e" />
              <StatCard title="Booking Aktif" value={String(stats.bookingAktif)} detail="sewa berlangsung" icon={<FileText className="h-5 w-5" />} color="#71302c" />
              <StatCard title="Pemasukan" value={currency(stats.totalPemasukan)} detail="total revenue" icon={<TrendingUp className="h-5 w-5" />} color="#16a34a" />
              <StatCard title="Laba Bersih" value={currency(stats.labaBersih)} detail={`${currency(stats.totalPengeluaran)} pengeluaran`} icon={<Activity className="h-5 w-5" />} color="#f59e0b" />
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md xl:col-span-1">
                <SectionHeader title="Status Armada" subtitle="Distribusi kondisi mobil" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={mobilChartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                        {mobilChartData.map((item) => <Cell key={item.name} fill={statusColors[item.name]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => `${value ?? 0} mobil`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md xl:col-span-2">
                <SectionHeader title="Mobil Paling Populer" subtitle="Jumlah booking per kendaraan" />
                <div className="space-y-3">
                  {popularCars.length > 0 ? popularCars.map((car) => (
                    <div key={car.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-800">{car.name}</p>
                        <p className="text-xs text-slate-500">{car.id}</p>
                      </div>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">{car.total} booking</span>
                    </div>
                  )) : <p className="text-sm text-slate-500">Belum ada data booking.</p>}
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
                <SectionHeader title="Jenis Layanan" subtitle="Pelayanan paling banyak dipilih" />
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceChartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={128} interval={0} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="total" radius={[0, 8, 8, 0]} fill="#9c342e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
                <SectionHeader title="Trend Pendapatan" subtitle="Pemasukan bulanan" />
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyChartData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        width={68}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(Number(value))}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                      <Legend />
                      <Line type="monotone" dataKey="value" name="Pemasukan" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </>
        ) : activeTab === "mobil" ? (
          <div className="space-y-6">
            <SectionHeader title="Monitoring Mobil" subtitle="CRUD dan status armada" action={<button onClick={() => { setEditingMobil(null); setNewMobilId(createId("M")); setError(""); setShowMobilForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Tambah Mobil</button>} />
            {showMobilForm && (
              <form onSubmit={handleSaveMobil} className="dashboard-panel-enter grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
                <h3 className="text-lg font-bold md:col-span-2">{editingMobil ? "Edit Data Mobil" : "Tambah Mobil Baru"}</h3>
                <input name="id_mobil" defaultValue={editingMobil?.id_mobil ?? newMobilId} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="ID Mobil" required />
                <input name="nama_mobil" defaultValue={editingMobil?.nama_mobil ?? defaultMobil.nama_mobil} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Nama Mobil" required />
                <input name="plat_nomor" defaultValue={editingMobil?.plat_nomor ?? defaultMobil.plat_nomor} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Plat Nomor" required />
                <input name="tipe_mobil" defaultValue={editingMobil?.tipe_mobil ?? defaultMobil.tipe_mobil} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Tipe Mobil" required />
                <select name="status_mobil" defaultValue={editingMobil?.status_mobil ?? defaultMobil.status_mobil} className="rounded-xl border border-slate-300 px-3 py-2">
                  <option value="Tersedia">Tersedia</option><option value="Disewa">Disewa</option><option value="Maintenance">Maintenance</option>
                </select>
                <NominalInput name="harga_per_hari" label="Harga sewa per hari (Rp)" defaultValue={editingMobil?.harga_per_hari ?? defaultMobil.harga_per_hari} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Contoh: 350.000" />
                <div className="md:col-span-2 flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowMobilForm(false); setEditingMobil(null); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium">Batal</button>
                  <button type="submit" disabled={savingForm === "mobil"} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{savingForm === "mobil" ? "Menyimpan..." : "Simpan"}</button>
                </div>
              </form>
            )}
            <div className="space-y-3 md:hidden">
              {mobil.map((item) => (
                <article key={item.id_mobil} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900">{item.nama_mobil}</h3>
                      <p className="mt-1 text-xs text-slate-500">{item.id_mobil} · {item.plat_nomor}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${statusColors[item.status_mobil]}22`, color: statusColors[item.status_mobil] }}>{item.status_mobil}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                    <div><p className="text-xs text-slate-500">{item.tipe_mobil}</p><p className="mt-1 font-semibold text-slate-900">{currency(item.harga_per_hari)}<span className="font-normal text-slate-500"> / hari</span></p></div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingMobil(item); setShowMobilForm(true); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Edit</button>
                      <button onClick={() => handleDeleteMobil(item.id_mobil)} className="rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Hapus</button>
                    </div>
                  </div>
                </article>
              ))}
              {mobil.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Belum ada data mobil.</p>}
            </div>
            <div className="hidden md:block">
              <DataTable>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Mobil</th><th className="px-4 py-3">Plat</th><th className="px-4 py-3">Tipe</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Harga/Day</th><th className="px-4 py-3">Aksi</th></tr></thead>
                  <tbody>
                    {mobil.map((item) => <tr key={item.id_mobil} className="border-t border-slate-200"><td className="px-4 py-3"><div className="font-semibold">{item.nama_mobil}</div><div className="text-xs text-slate-500">{item.id_mobil}</div></td><td className="px-4 py-3">{item.plat_nomor}</td><td className="px-4 py-3">{item.tipe_mobil}</td><td className="px-4 py-3"><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${statusColors[item.status_mobil]}22`, color: statusColors[item.status_mobil] }}>{item.status_mobil}</span></td><td className="px-4 py-3">{currency(item.harga_per_hari)}</td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => { setEditingMobil(item); setShowMobilForm(true); }} className="text-blue-600">Edit</button><button onClick={() => handleDeleteMobil(item.id_mobil)} className="text-red-600">Hapus</button></div></td></tr>)}
                  </tbody>
                </table>
              </DataTable>
            </div>
          </div>
        ) : activeTab === "booking" ? (
          <div className="space-y-6">
            <SectionHeader title="Monitoring Booking" subtitle="Jadwal sewa dan status aktif" action={<button onClick={() => { setEditingBooking(null); setBookingStartDate(String(defaultBooking.tgl_mulai)); setBookingEndDate(String(defaultBooking.tgl_selesai)); setSelectedService(String(defaultBooking.jenis_layanan)); setCustomService(""); setNewBookingId(createId("BK")); setError(""); setShowBookingForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Tambah Booking</button>} />
            {showBookingForm && (
              <form onSubmit={handleSaveBooking} className="dashboard-panel-enter grid gap-x-5 gap-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
                <h3 className="text-lg font-bold sm:col-span-2 xl:col-span-3">{editingBooking ? "Edit Data Booking" : "Input Booking Baru"}</h3>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">ID Booking
                  <input name="id_booking" defaultValue={editingBooking?.id_booking ?? newBookingId} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" placeholder="ID Booking" required />
                </label>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Mobil
                  <select name="id_mobil" defaultValue={editingBooking?.id_mobil ?? (mobil.some((item) => item.id_mobil === defaultBooking.id_mobil) ? defaultBooking.id_mobil : "")} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" required>
                    <option value="" disabled>Pilih mobil</option>
                    {mobil.map((item) => <option key={item.id_mobil} value={item.id_mobil} disabled={item.status_mobil !== "Tersedia" && item.id_mobil !== editingBooking?.id_mobil}>{item.id_mobil} · {item.nama_mobil}{item.status_mobil === "Disewa" && item.id_mobil !== editingBooking?.id_mobil ? " · Tidak tersedia" : ""}</option>)}
                  </select>
                </label>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Nama Penyewa
                  <input name="nama_penyewa" defaultValue={editingBooking?.nama_penyewa ?? defaultBooking.nama_penyewa} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" placeholder="Nama Penyewa" required />
                </label>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Nomor HP
                  <input name="no_hp" defaultValue={editingBooking?.no_hp ?? defaultBooking.no_hp} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" placeholder="Nomor HP" required />
                </label>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Tanggal mulai
                  <input name="tgl_mulai" type="date" value={bookingStartDate} onChange={(event) => { const nextDate = event.currentTarget.value; setBookingStartDate(nextDate); if (bookingEndDate < nextDate) setBookingEndDate(nextDate); }} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" required />
                </label>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Tanggal selesai
                  <input name="tgl_selesai" type="date" min={bookingStartDate} value={bookingEndDate} onChange={(event) => setBookingEndDate(event.currentTarget.value)} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" required />
                </label>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Durasi sewa (hari)
                  <input name="durasi_hari" type="number" value={calculateRentalDays(bookingStartDate, bookingEndDate)} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-3 font-normal text-slate-700" readOnly aria-readonly="true" />
                  <span className="text-xs font-normal text-slate-500">Terhitung otomatis dari jadwal sewa.</span>
                </label>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Jenis layanan
                  <select name="jenis_layanan" value={selectedService} onChange={(event) => setSelectedService(event.currentTarget.value)} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" required>
                    {serviceOptions.map((service) => <option key={service} value={service}>{service}</option>)}
                  </select>
                  {selectedService === "Lainnya" && <input value={customService} onChange={(event) => setCustomService(event.currentTarget.value)} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" placeholder="Ketik jenis layanan" required />}
                </label>
                <NominalInput name="total_biaya" label="Total biaya sewa (Rp)" helperText="Jumlah tagihan penuh untuk booking ini." defaultValue={editingBooking?.total_biaya ?? defaultBooking.total_biaya} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" placeholder="Contoh: 1.500.000" />
                <NominalInput name="jumlah_dibayar" label="Sudah dibayar (Rp)" helperText="Isi 0 jika belum ada pembayaran." defaultValue={editingBooking ? paymentsByBooking.get(editingBooking.id_booking) ?? (editingBooking.status_pembayaran === "Lunas" ? editingBooking.total_biaya : 0) : 0} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" placeholder="Contoh: 500.000" />
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Status pembayaran
                  <select name="status_pembayaran" defaultValue={editingBooking?.status_pembayaran ?? defaultBooking.status_pembayaran} onChange={handlePaymentStatusChange} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900"><option value="Lunas">Lunas</option><option value="DP">DP</option><option value="Menunggu">Menunggu</option><option value="Dibatalkan">Dibatalkan</option></select>
                </label>
                <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium text-slate-700">Status sewa
                  <select name="status_sewa" defaultValue={editingBooking?.status_sewa ?? defaultBooking.status_sewa} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 font-normal text-slate-900"><option value="Aktif">Aktif</option><option value="Selesai">Selesai</option><option value="Terjadwal">Terjadwal</option><option value="Dibatalkan">Dibatalkan</option></select>
                </label>
                <div className="flex justify-end gap-2 sm:col-span-2 xl:col-span-3"><button type="button" onClick={() => { setShowBookingForm(false); setEditingBooking(null); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Batal</button><button type="submit" disabled={savingForm === "booking"} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{savingForm === "booking" ? "Menyimpan..." : "Simpan Booking"}</button></div>
              </form>
            )}
            <div className="space-y-3 md:hidden">
              {booking.map((item) => (
                <article key={item.id_booking} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">{item.nama_penyewa}</h3>
                      <p className="mt-1 text-xs text-slate-500">{item.id_booking} · {item.id_mobil}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${statusColors[item.status_sewa]}22`, color: statusColors[item.status_sewa] }}>{item.status_sewa}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                    <div><p className="text-xs text-slate-500">Periode sewa</p><p className="mt-1 font-medium">{formatDate(item.tgl_mulai)} – {formatDate(item.tgl_selesai)}</p></div>
                    <div><p className="text-xs text-slate-500">Total biaya</p><p className="mt-1 font-semibold">{currency(item.total_biaya)}</p></div>
                    <div><p className="text-xs text-slate-500">Pembayaran</p><p className="mt-1 font-medium">{item.status_pembayaran} · {currency(paymentsByBooking.get(item.id_booking) ?? 0)}</p></div>
                    <div><p className="text-xs text-slate-500">Kontak</p><p className="mt-1 font-medium">{item.no_hp}</p></div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => { setEditingBooking(item); setBookingStartDate(item.tgl_mulai); setBookingEndDate(item.tgl_selesai); const isStandardService = serviceOptions.includes(item.jenis_layanan as typeof serviceOptions[number]); setSelectedService(isStandardService ? item.jenis_layanan : "Lainnya"); setCustomService(isStandardService ? "" : item.jenis_layanan); setShowBookingForm(true); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Edit</button>
                    <button onClick={() => handleDeleteBooking(item.id_booking)} className="rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Hapus</button>
                  </div>
                </article>
              ))}
              {booking.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Belum ada booking bulan ini.</p>}
            </div>
            <div className="hidden md:block">
              <DataTable>
                <table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Booking</th><th className="px-4 py-3">Penyewa</th><th className="px-4 py-3">Jangka</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Pembayaran</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead><tbody>{booking.map((item) => <tr key={item.id_booking} className="border-t border-slate-200"><td className="px-4 py-3"><div className="font-semibold">{item.id_booking}</div><div className="text-xs text-slate-500">{item.id_mobil}</div></td><td className="px-4 py-3"><div className="font-medium">{item.nama_penyewa}</div><div className="text-xs text-slate-500">{item.no_hp}</div></td><td className="px-4 py-3">{formatDate(item.tgl_mulai)}<br /><span className="text-xs text-slate-500">s.d {formatDate(item.tgl_selesai)}</span></td><td className="px-4 py-3 font-semibold">{currency(item.total_biaya)}</td><td className="px-4 py-3"><div><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${statusColors[item.status_pembayaran]}22`, color: statusColors[item.status_pembayaran] }}>{item.status_pembayaran}</span><div className="mt-1 text-xs text-slate-500">Dibayar {currency(paymentsByBooking.get(item.id_booking) ?? 0)}</div></div></td><td className="px-4 py-3"><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${statusColors[item.status_sewa]}22`, color: statusColors[item.status_sewa] }}>{item.status_sewa}</span></td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => { setEditingBooking(item); setBookingStartDate(item.tgl_mulai); setBookingEndDate(item.tgl_selesai); const isStandardService = serviceOptions.includes(item.jenis_layanan as typeof serviceOptions[number]); setSelectedService(isStandardService ? item.jenis_layanan : "Lainnya"); setCustomService(isStandardService ? "" : item.jenis_layanan); setShowBookingForm(true); }} className="text-blue-600">Edit</button><button onClick={() => handleDeleteBooking(item.id_booking)} className="text-red-600">Hapus</button></div></td></tr>)}</tbody></table>
              </DataTable>
            </div>
          </div>
        ) : activeTab === "keuangan" ? (
          <div className="space-y-6">
            <SectionHeader title="Monitoring Keuangan" subtitle="Pemasukan otomatis dari pembayaran booking; catat pengeluaran beserta rincian agar mudah dikenali di Arsip." action={<button onClick={() => { setEditingKeuangan(null); setNewKeuanganId(createId("TRX")); setError(""); setShowKeuanganForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Tambah Pengeluaran</button>} />
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5"><p className="text-sm text-green-700">Pemasukan</p><h3 className="mt-2 text-2xl font-bold text-green-900">{currency(stats.totalPemasukan)}</h3></div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><p className="text-sm text-red-700">Pengeluaran</p><h3 className="mt-2 text-2xl font-bold text-red-900">{currency(stats.totalPengeluaran)}</h3></div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm text-blue-700">Laba Bersih</p><h3 className="mt-2 text-2xl font-bold text-blue-900">{currency(stats.labaBersih)}</h3></div>
            </section>
            {showKeuanganForm && (
              <form onSubmit={handleSaveKeuangan} className="dashboard-panel-enter overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-red-100 bg-red-50/70 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">{editingKeuangan ? "Perbarui catatan" : "Pengeluaran baru"}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{editingKeuangan ? "Edit Transaksi Keuangan" : "Catat Pengeluaran"}</h3>
                  <p className="mt-1 text-sm text-slate-600">Tulis rincian yang spesifik supaya transaksi mudah dikenali saat dicari di Arsip.</p>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    ID Transaksi
                    <input name="id_transaksi" defaultValue={editingKeuangan?.id_transaksi ?? newKeuanganId} className="h-10 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" required />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Tanggal transaksi
                    <input name="tanggal" type="date" defaultValue={editingKeuangan?.tanggal ?? defaultKeuangan.tanggal} className="h-10 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" required />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    Jenis transaksi
                    <select name="tipe_transaksi" defaultValue={editingKeuangan?.tipe_transaksi ?? defaultKeuangan.tipe_transaksi} className="h-10 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" disabled={!editingKeuangan}>
                      <option value="Pengeluaran">Pengeluaran</option>
                      {editingKeuangan?.tipe_transaksi === "Pemasukan" && <option value="Pemasukan">Pemasukan</option>}
                    </select>
                  </label>
                  <NominalInput name="jumlah" label={editingKeuangan?.tipe_transaksi === "Pemasukan" ? "Nominal pemasukan (Rp)" : "Nominal pengeluaran (Rp)"} defaultValue={editingKeuangan?.jumlah ?? defaultKeuangan.jumlah} className="h-10 rounded-lg border border-slate-300 px-3 font-normal text-slate-900" placeholder="Contoh: 250.000" />
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
                    Rincian transaksi
                    <textarea name="keterangan" defaultValue={editingKeuangan?.keterangan ?? defaultKeuangan.keterangan} className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" placeholder="Contoh: Servis rutin Toyota Avanza atau pembelian perlengkapan kantor" maxLength={200} required />
                    <span className="text-xs font-normal text-slate-500">Rincian ini akan ditampilkan di daftar Keuangan dan Arsip.</span>
                  </label>
                  <div className="flex justify-end gap-2 md:col-span-2">
                    <button type="button" onClick={() => { setShowKeuanganForm(false); setEditingKeuangan(null); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium">Batal</button>
                    <button type="submit" disabled={savingForm === "keuangan"} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{savingForm === "keuangan" ? "Menyimpan..." : "Simpan Transaksi"}</button>
                  </div>
                </div>
              </form>
            )}
            <div className="space-y-3 md:hidden">
              {keuangan.map((item) => (
                <article key={item.id_transaksi} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-xs text-slate-500">{item.id_transaksi}</p>
                      <h3 className="mt-1 break-words font-semibold text-slate-900">{item.keterangan || item.kategori || "Keterangan belum diisi"}</h3>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.tipe_transaksi === "Pemasukan" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{item.tipe_transaksi}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                    <div><p className="text-xs text-slate-500">{formatDate(item.tanggal)}{item.id_booking ? ` · Booking ${item.id_booking}` : ""}</p><p className="mt-1 text-lg font-bold text-slate-900">{currency(Number(item.jumlah))}</p></div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingKeuangan(item); setShowKeuanganForm(true); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Edit</button>
                      <button onClick={() => handleDeleteKeuangan(item.id_transaksi)} className="rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Hapus</button>
                    </div>
                  </div>
                </article>
              ))}
              {keuangan.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Belum ada transaksi bulan ini.</p>}
            </div>
            <div className="hidden md:block">
              <DataTable>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr><th className="px-4 py-3">Transaksi</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Rincian</th><th className="px-4 py-3">Jumlah</th><th className="px-4 py-3">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {keuangan.map((item) => (
                      <tr key={item.id_transaksi} className="border-t border-slate-200">
                        <td className="px-4 py-3"><div className="font-semibold">{item.id_transaksi}</div>{item.id_booking && <div className="text-xs text-slate-500">Booking {item.id_booking}</div>}</td>
                        <td className="whitespace-nowrap px-4 py-3">{formatDate(item.tanggal)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.tipe_transaksi === "Pemasukan" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{item.tipe_transaksi}</span></td>
                        <td className="min-w-48 px-4 py-3"><div className="font-medium text-slate-800">{item.keterangan || item.kategori || "Keterangan belum diisi"}</div>{item.keterangan && item.kategori && <div className="mt-0.5 text-xs text-slate-500">{item.kategori}</div>}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">{currency(Number(item.jumlah))}</td>
                        <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => { setEditingKeuangan(item); setShowKeuanganForm(true); }} className="text-blue-600">Edit</button><button onClick={() => handleDeleteKeuangan(item.id_transaksi)} className="text-red-600">Hapus</button></div></td>
                      </tr>
                    ))}
                    {keuangan.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada transaksi keuangan bulan ini.</td></tr>}
                  </tbody>
                </table>
              </DataTable>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <SectionHeader title="Arsip Data" subtitle="Cari semua riwayat booking dan transaksi keuangan. Daftar aktif menampilkan data bulan ini." />
            <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="grid gap-2 text-sm font-medium text-slate-700">Cari data
                <span className="relative">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="search" value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Nama, ID, rincian transaksi..." className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 sm:w-64" />
                </span>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">Cari satu bulan
                <input type="month" value={archiveMonth} onChange={(event) => { setArchiveMonth(event.target.value); setArchiveDate(""); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 sm:w-auto" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">Atau cari satu hari
                <input type="date" value={archiveDate} onChange={(event) => { setArchiveDate(event.target.value); setArchiveMonth(""); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 sm:w-auto" />
              </label>
              {(archiveSearch || archiveMonth || archiveDate) && <button type="button" onClick={() => { setArchiveSearch(""); setArchiveMonth(""); setArchiveDate(""); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium">Hapus Filter</button>}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">Booking Terarsip</h3>
                <div className="mt-4 space-y-3">
                  {visibleArchiveBookings.length === 0 ? <p className="text-sm text-slate-500">Tidak ada booking yang cocok dengan pencarian atau filter.</p> : visibleArchiveBookings.map((item) => <div key={item.id_booking} className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between gap-4"><div><p className="font-semibold">{item.nama_penyewa}</p><p className="text-xs text-slate-500">{item.id_booking} · {item.id_mobil}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.tgl_mulai)} s.d. {formatDate(item.tgl_selesai)} · {currency(Number(item.total_biaya))}</p></div><button onClick={() => void handleDeleteArchive("booking", item.id_booking)} className="text-xs font-semibold text-red-600">Hapus Permanen</button></div><p className="mt-2 text-sm text-slate-500">Diarsip pada {formatDate(item.archived_at)}</p></div>)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">Keuangan Terarsip</h3>
                <div className="mt-4 space-y-3">
                  {visibleArchiveKeuangan.length === 0 ? <p className="text-sm text-slate-500">Tidak ada transaksi yang cocok dengan pencarian atau filter.</p> : visibleArchiveKeuangan.map((item) => {
                    const isExpense = item.tipe_transaksi === "Pengeluaran";
                    const detail = item.keterangan?.trim() || item.kategori?.trim() || "Keterangan belum diisi";
                    return (
                      <div key={item.id_transaksi} className={`rounded-xl border p-4 ${isExpense ? "border-red-100 bg-red-50/50" : "border-green-100 bg-green-50/50"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isExpense ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{item.tipe_transaksi}</span>
                              <span className="text-lg font-bold text-slate-900">{currency(Number(item.jumlah))}</span>
                            </div>
                            <p className="mt-2 break-words font-semibold text-slate-800">{detail}</p>
                            <p className="mt-1 break-all text-xs text-slate-500">{item.id_transaksi}{item.id_booking ? ` · Booking ${item.id_booking}` : ""}</p>
                            <p className="mt-1 text-sm text-slate-600">Tanggal transaksi: {formatDate(item.tanggal)}</p>
                          </div>
                          <button onClick={() => void handleDeleteArchive("keuangan", item.id_transaksi)} className="shrink-0 text-xs font-semibold text-red-600">Hapus Permanen</button>
                        </div>
                        <p className="mt-3 border-t border-slate-200/70 pt-2 text-xs text-slate-500">Diarsip pada {formatDate(item.archived_at)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
    </div>
  );
}
