import "server-only";

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import path from "node:path";

export const SHEET_NAMES = [
  "mobil",
  "booking",
  "keuangan",
  "archive_booking",
  "archive_keuangan",
  "users",
] as const;

export type SheetName = typeof SHEET_NAMES[number];

const spreadsheetId = "1hOoPnoP26jyuPKnpxTDcQY12nWjI7LGywlekbBbNUlk";
const dateColumns = new Set(["tgl_mulai", "tgl_selesai", "tanggal", "created_at", "archived_at"]);
const serviceAccountJson = process.env.GOOGLE_CREDENTIALS;

function parseServiceAccountCredentials(value: string) {
  let credentials: unknown;
  try {
    credentials = JSON.parse(value);
  } catch (error) {
    throw new Error("GOOGLE_CREDENTIALS harus berisi JSON service account yang valid.", { cause: error });
  }

  if (
    typeof credentials !== "object"
    || credentials === null
    || !("client_email" in credentials)
    || typeof credentials.client_email !== "string"
    || !("private_key" in credentials)
    || typeof credentials.private_key !== "string"
  ) {
    throw new Error("GOOGLE_CREDENTIALS harus memiliki client_email dan private_key.");
  }

  return {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  };
}

if (process.env.VERCEL && !serviceAccountJson) {
  throw new Error("GOOGLE_CREDENTIALS belum dikonfigurasi pada environment Vercel.");
}

const auth = new google.auth.GoogleAuth({
  ...(serviceAccountJson
    ? { credentials: parseServiceAccountCredentials(serviceAccountJson) }
    : { keyFile: path.resolve(process.cwd(), "renne-db-8dc44d24a856.json") }),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const headerCache = new Map<SheetName, Promise<string[]>>();
let sheetPropertiesPromise: Promise<Map<SheetName, number>> | undefined;

function validateSheetName(sheetName: string): asserts sheetName is SheetName {
  if (!SHEET_NAMES.includes(sheetName as SheetName)) {
    throw new Error(`Nama sheet "${sheetName}" tidak diizinkan.`);
  }
}

function quotedRange(sheetName: SheetName, range: string) {
  return `'${sheetName}'!${range}`;
}

function columnLetter(columnNumber: number) {
  let value = columnNumber;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function getHeaderRow(sheetName: SheetName) {
  let headerPromise = headerCache.get(sheetName);
  if (!headerPromise) {
    headerPromise = sheets.spreadsheets.values
      .get({ spreadsheetId, range: quotedRange(sheetName, "1:1") })
      .then(({ data }) => (data.values?.[0] ?? []).map((value) => String(value).trim()));
    headerCache.set(sheetName, headerPromise);
    void headerPromise.catch(() => headerCache.delete(sheetName));
  }
  const headers = await headerPromise;
  if (headers.length === 0) {
    throw new Error(`Sheet "${sheetName}" tidak memiliki header di baris pertama.`);
  }
  return headers;
}

async function getRowsWithIndexes<T extends object>(sheetName: SheetName) {
  const headers = await getHeaderRow(sheetName);
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: quotedRange(sheetName, `A2:${columnLetter(headers.length)}`),
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (data.values ?? []).map((values, index) => ({
    rowNumber: index + 2,
    row: Object.fromEntries(headers.map((header, column) => {
      const value = values[column] ?? "";
      if (typeof value === "number" && dateColumns.has(header)) {
        const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
        return [header, header === "created_at" || header === "archived_at"
          ? date.toISOString()
          : date.toISOString().slice(0, 10)];
      }
      return [header, value];
    })) as T,
  }));
}

function valuesForRow(headers: string[], row: object) {
  const rowValues = row as Record<string, unknown>;
  const unknownColumns = Object.keys(rowValues).filter((key) => !headers.includes(key));
  if (unknownColumns.length > 0) {
    throw new Error(`Kolom ${unknownColumns.join(", ")} belum tersedia di header sheet.`);
  }
  return headers.map((header) => {
    const value = rowValues[header];
    return value === null || value === undefined ? "" : value;
  });
}

async function getSheetProperties() {
  if (!sheetPropertiesPromise) {
    sheetPropertiesPromise = sheets.spreadsheets
      .get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" })
      .then(({ data }) => {
        const properties = new Map<SheetName, number>();
        for (const sheet of data.sheets ?? []) {
          const title = sheet.properties?.title;
          const sheetId = sheet.properties?.sheetId;
          if (title && SHEET_NAMES.includes(title as SheetName) && typeof sheetId === "number") {
            properties.set(title as SheetName, sheetId);
          }
        }
        return properties;
      });
    void sheetPropertiesPromise.catch(() => {
      sheetPropertiesPromise = undefined;
    });
  }
  return sheetPropertiesPromise;
}

export async function getRows<T extends object>(sheetName: SheetName): Promise<T[]> {
  validateSheetName(sheetName);
  return (await getRowsWithIndexes<T>(sheetName)).map(({ row }) => row);
}

export async function appendRow<T extends object>(sheetName: SheetName, row: T) {
  validateSheetName(sheetName);
  const headers = await getHeaderRow(sheetName);
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: quotedRange(sheetName, "A:ZZ"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [valuesForRow(headers, row)] },
  });
  return response.data;
}

export async function updateRow<T extends object>(
  sheetName: SheetName,
  idColumn: string,
  id: string,
  data: Partial<T>,
) {
  validateSheetName(sheetName);
  const headers = await getHeaderRow(sheetName);
  if (!headers.includes(idColumn)) {
    throw new Error(`Kolom ID "${idColumn}" belum tersedia di header sheet "${sheetName}".`);
  }
  const rows = await getRowsWithIndexes<T>(sheetName);
  const existing = rows.find(({ row }) => String((row as Record<string, unknown>)[idColumn] ?? "") === id);
  if (!existing) {
    throw new Error(`Data dengan ID ${id} tidak ditemukan di ${sheetName}: No results found`);
  }

  const updatedRow = { ...existing.row, ...data };
  const lastColumn = columnLetter(headers.length);
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: quotedRange(sheetName, `A${existing.rowNumber}:${lastColumn}${existing.rowNumber}`),
    valueInputOption: "RAW",
    requestBody: { values: [valuesForRow(headers, updatedRow)] },
  });
  return response.data;
}

export async function deleteRow(sheetName: SheetName, idColumn: string, id: string) {
  validateSheetName(sheetName);
  const headers = await getHeaderRow(sheetName);
  if (!headers.includes(idColumn)) {
    throw new Error(`Kolom ID "${idColumn}" belum tersedia di header sheet "${sheetName}".`);
  }
  const rows = await getRowsWithIndexes<Record<string, unknown>>(sheetName);
  const existing = rows.find(({ row }) => String(row[idColumn] ?? "") === id);
  if (!existing) {
    throw new Error(`Data dengan ID ${id} tidak ditemukan di ${sheetName}: No results found`);
  }

  const properties = await getSheetProperties();
  const sheetId = properties.get(sheetName);
  if (typeof sheetId !== "number") {
    throw new Error(`Sheet "${sheetName}" tidak ditemukan pada spreadsheet.`);
  }

  const request: sheets_v4.Schema$Request = {
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: existing.rowNumber - 1,
        endIndex: existing.rowNumber,
      },
    },
  };
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [request] },
  });
  return response.data;
}
