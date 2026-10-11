import { appendRow, getRows, updateRow } from "@/lib/googleSheets";

export function mergeArchiveRows<T extends object>(
  archived: Array<T & { archived_at?: string }>,
  active: T[],
  idColumn: keyof T,
  fallbackArchiveDate: (row: T) => string,
) {
  const rowsById = new Map<string, T & { archived_at: string }>();
  for (const row of [...active, ...archived]) {
    const id = String((row as Record<string, unknown>)[String(idColumn)] ?? "");
    if (!id) continue;
    rowsById.set(id, {
      ...row,
      archived_at: String((row as T & { archived_at?: string }).archived_at ?? fallbackArchiveDate(row)),
    });
  }
  return [...rowsById.values()];
}

export async function upsertArchivedRecord<T extends object>(
  sheet: "archive_booking" | "archive_keuangan",
  idColumn: "id_booking" | "id_transaksi",
  id: string,
  record: T,
) {
  const rows = await getRows<T & { archived_at?: string }>(sheet);
  const existing = rows.find((row) => String((row as Record<string, unknown>)[idColumn] ?? "") === id);
  const archivedRecord = {
    ...record,
    archived_at: existing?.archived_at ?? new Date().toISOString(),
  };

  if (existing) {
    return updateRow(sheet, idColumn, id, archivedRecord);
  }

  return appendRow(sheet, archivedRecord);
}
