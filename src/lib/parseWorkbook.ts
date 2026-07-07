import * as XLSX from "xlsx";
import { normalizeText } from "./normalize";
import type { RawRow } from "./types";

export type ParsedSheet = {
  sheetName: string;
  rows: RawRow[];
  skippedRows: number;
};

type ColumnMap = {
  name: number;
  route: number;
  tourNo: number;
  date: number;
  seats: number;
  sold: number;
};

const DEFAULT_ORDER: ColumnMap = { name: 0, route: 1, tourNo: 2, date: 3, seats: 4, sold: 5 };

function matchColumn(headers: string[], test: (h: string) => boolean): number {
  return headers.findIndex((h) => test(h));
}

function detectColumns(headerRow: unknown[]): ColumnMap {
  const headers = headerRow.map((h) => normalizeText(h).toLowerCase());

  const name = matchColumn(headers, (h) => h.includes("назв") || h === "имя");
  const route = matchColumn(headers, (h) => h.includes("маршрут"));
  const tourNo = matchColumn(headers, (h) => h.includes("тура") || h.includes("№") || h.includes("id"));
  const date = matchColumn(headers, (h) => h.includes("дата"));
  const seats = matchColumn(headers, (h) => h.includes("мест"));
  const sold = matchColumn(headers, (h) => h.includes("продано"));

  return {
    name: name >= 0 ? name : DEFAULT_ORDER.name,
    route: route >= 0 ? route : DEFAULT_ORDER.route,
    tourNo: tourNo >= 0 ? tourNo : DEFAULT_ORDER.tourNo,
    date: date >= 0 ? date : DEFAULT_ORDER.date,
    seats: seats >= 0 ? seats : DEFAULT_ORDER.seats,
    sold: sold >= 0 ? sold : DEFAULT_ORDER.sold,
  };
}

function toDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    // Excel serial date fallback
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function parseSheetRows(sheetName: string, matrix: unknown[][]): ParsedSheet {
  const nonEmptyRows = matrix.filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""));
  if (nonEmptyRows.length === 0) return { sheetName, rows: [], skippedRows: 0 };

  const cols = detectColumns(nonEmptyRows[0]);
  const rows: RawRow[] = [];
  let skipped = 0;

  for (const raw of nonEmptyRows.slice(1)) {
    const tourNoRaw = raw[cols.tourNo];
    const name = normalizeText(raw[cols.name]);
    if (!name || tourNoRaw === null || tourNoRaw === undefined || tourNoRaw === "") {
      skipped++;
      continue;
    }
    rows.push({
      name,
      route: normalizeText(raw[cols.route]),
      tourNo: String(tourNoRaw).trim(),
      date: toDateString(raw[cols.date]),
      seats: toNumber(raw[cols.seats]),
      sold: toNumber(raw[cols.sold]),
      sourceSheet: sheetName,
    });
  }

  return { sheetName, rows, skippedRows: skipped };
}

export function parseWorkbookBuffer(buffer: ArrayBuffer): ParsedSheet[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    return parseSheetRows(sheetName, matrix);
  });
}
