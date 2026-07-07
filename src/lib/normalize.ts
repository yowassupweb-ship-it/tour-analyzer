// Every character that shows up in the wild as a "dash" — hyphen-minus,
// non-breaking hyphen, figure dash, en/em dash, horizontal bar, minus sign.
const DASH_CHARS = /[‐‑‒–—―−-]/g;

export function normalizeDashes(value: string): string {
  return value
    .replace(DASH_CHARS, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return normalizeDashes(String(value));
}

// Strips a trailing " - <number>" suffix, e.g.
// "Тайны Несвижского замка - 4" -> "Тайны Несвижского замка". The number is
// the trip length in days, so two products sharing this key are editions
// (a "matryoshka") of one same tour, not competitors.
export function familyKey(name: string): string {
  return name.replace(/\s*-\s*\d+\s*$/, "").trim().toLowerCase();
}
