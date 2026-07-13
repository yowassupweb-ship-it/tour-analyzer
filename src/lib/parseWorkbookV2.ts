import * as XLSX from "xlsx";
import type { RawRowV2 } from "./analyzeV2";

export type ParsedSheetV2 = {
  sheetName: string;
  rows: RawRowV2[];
  skippedRows: number;
};

const DASH_CHARS = /[‐‑‒–—―−-]/g;

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(DASH_CHARS, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

// Real exports from this business don't have a dedicated duration column —
// the trip length rides as a trailing number in the route name instead
// (e.g. "Брестская кругосветка - 5" is the 5-day edition). Used only when no
// explicit "Продолжительность" column is found.
function trailingDuration(name: string): number {
  const match = name.match(/\s*-\s*(\d+)\s*$/);
  return match ? Number(match[1]) : 1;
}

type ColumnMap = {
  routeName: number;
  route: number;
  duration: number;
  tourId: number;
  date: number;
  seats: number;
  sold: number;
};

const DEFAULT_ORDER: ColumnMap = { routeName: 0, route: 1, duration: 2, tourId: 3, date: 4, seats: 5, sold: 6 };

function matchColumn(headers: string[], test: (h: string) => boolean): number {
  return headers.findIndex(test);
}

function detectColumns(headerRow: unknown[]): ColumnMap {
  const headers = headerRow.map((h) => normalizeText(h).toLowerCase());

  const routeName = matchColumn(headers, (h) => h.includes("назв"));
  const route = matchColumn(headers, (h) => h.includes("маршрут") && !h.includes("назв"));
  const duration = matchColumn(headers, (h) => h.includes("продолжит") || h.includes("длительн") || h.includes("дней"));
  const tourId = matchColumn(headers, (h) => h.includes("id") || h.includes("№") || (h.includes("тур") && !h.includes("маршрут")));
  const date = matchColumn(headers, (h) => h.includes("дата") || h.includes("выезд"));
  const seats = matchColumn(headers, (h) => h.includes("мест"));
  const sold = matchColumn(headers, (h) => h.includes("продано"));

  return {
    routeName: routeName >= 0 ? routeName : DEFAULT_ORDER.routeName,
    route: route >= 0 ? route : DEFAULT_ORDER.route,
    duration: duration >= 0 ? duration : -1, // -1 means "derive from name" (see trailingDuration)
    tourId: tourId >= 0 ? tourId : DEFAULT_ORDER.tourId,
    date: date >= 0 ? date : DEFAULT_ORDER.date,
    seats: seats >= 0 ? seats : DEFAULT_ORDER.seats,
    sold: sold >= 0 ? sold : DEFAULT_ORDER.sold,
  };
}

function toDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function parseSheetRowsV2(sheetName: string, matrix: unknown[][]): ParsedSheetV2 {
  const nonEmptyRows = matrix.filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""));
  if (nonEmptyRows.length === 0) return { sheetName, rows: [], skippedRows: 0 };

  const cols = detectColumns(nonEmptyRows[0]);
  const rows: RawRowV2[] = [];
  let skipped = 0;

  for (const raw of nonEmptyRows.slice(1)) {
    const tourIdRaw = raw[cols.tourId];
    const routeName = normalizeText(raw[cols.routeName]);
    const date = toDateString(raw[cols.date]);
    if (!routeName || tourIdRaw === null || tourIdRaw === undefined || tourIdRaw === "" || !date) {
      skipped++;
      continue;
    }

    rows.push({
      routeName,
      route: normalizeText(raw[cols.route]),
      durationDays: cols.duration >= 0 ? toNumber(raw[cols.duration]) : trailingDuration(routeName),
      tourId: String(tourIdRaw).trim(),
      departureDate: date,
      seats: toNumber(raw[cols.seats]),
      sold: toNumber(raw[cols.sold]),
    });
  }

  return { sheetName, rows, skippedRows: skipped };
}

export function parseWorkbookBufferV2(buffer: ArrayBuffer): ParsedSheetV2[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    return parseSheetRowsV2(sheetName, matrix);
  });
}
