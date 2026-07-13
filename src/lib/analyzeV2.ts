// Analyzer v2 — a self-contained engine implementing a different spec than
// v1 (src/lib/analyze.ts): Load Factor, event detection, Jaccard route
// similarity, a cannibalization penalty, and a five-rule decision matrix
// with SEO directives. Deliberately does not import from analyze.ts — the
// math and the verdicts here are not the same model.

export type SeasonV2 = "Лето" | "Зима";

export type RawRowV2 = {
  routeName: string; // Название маршрута
  route: string; // Маршрут (dash-separated stops)
  durationDays: number; // Продолжительность, в днях
  tourId: string; // ID тура
  departureDate: string; // Дата выезда, ISO yyyy-mm-dd
  seats: number; // Мест в продаже
  sold: number; // Продано
};

export type DecisionV2 = "FORCE_DELETE" | "KEEP_EVENT" | "OPTIMIZE_CANNIBAL" | "KEEP_LEADER" | "REVISE";
export type SeoActionV2 = "NOINDEX" | "MANUAL_SEO" | "CANONICAL" | "AUTO_TEMPLATE";

export type TourVerdictV2 = {
  row: RawRowV2;
  lf: number; // Load Factor, 0..1
  season: SeasonV2;
  isEvent: boolean;
  cannibalPenalty: number;
  finalScore: number;
  decision: DecisionV2;
  seoAction: SeoActionV2;
  canonicalTarget: RawRowV2 | null;
};

export type ReportV2 = {
  rows: TourVerdictV2[];
  criticalDates: { date: string; duplicateCount: number }[];
  focusAttention: TourVerdictV2[];
};

const JACCARD_THRESHOLD = 0.65;
const CANNIBAL_PENALTY_FACTOR = 0.3;
const DURATION_DIFF_MAX = 2;
const LF_HARD_STOP = 0.15;
const LF_EVENT_SUCCESS = 0.5;
const FINAL_SCORE_CANNIBAL = 0.45;
const FINAL_SCORE_LEADER = 0.6;

export function seasonOf(dateIso: string): SeasonV2 {
  const month = Number(dateIso.slice(5, 7));
  return month >= 4 && month <= 10 ? "Лето" : "Зима";
}

// "Уникальные слова-локации": every dash-separated stop, further split on
// whitespace, lowercased — e.g. "Минск - Мир - Несвиж" -> {минск, мир, несвиж}.
function locationWords(route: string): Set<string> {
  const words = route
    .toLowerCase()
    .split(/[-–—,]/)
    .flatMap((part) => part.trim().split(/\s+/))
    .filter((w) => w.length > 0);
  return new Set(words);
}

export function jaccardSimilarity(routeA: string, routeB: string): number {
  const a = locationWords(routeA);
  const b = locationWords(routeB);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function loadFactor(row: RawRowV2): number {
  return row.seats > 0 ? row.sold / row.seats : 0;
}

// A route is an "event" within a season if it has exactly one distinct
// departure date scheduled that season — a one-off, not a recurring product.
function computeEventFlags(rows: RawRowV2[]): Map<RawRowV2, boolean> {
  const datesByRouteSeason = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${row.route}__${seasonOf(row.departureDate)}`;
    const set = datesByRouteSeason.get(key);
    if (set) set.add(row.departureDate);
    else datesByRouteSeason.set(key, new Set([row.departureDate]));
  }

  const flags = new Map<RawRowV2, boolean>();
  for (const row of rows) {
    const key = `${row.route}__${seasonOf(row.departureDate)}`;
    flags.set(row, datesByRouteSeason.get(key)!.size === 1);
  }
  return flags;
}

// Cannibalization is only compared same-season, same departure date, and
// duration within 2 days — a 3-day and a 9-day tour are different products
// even on an identical route. Event tours never take or cause a penalty.
function computeCannibalPenalties(
  rows: RawRowV2[],
  isEvent: Map<RawRowV2, boolean>
): Map<RawRowV2, { penalty: number; leader: RawRowV2 | null }> {
  const result = new Map<RawRowV2, { penalty: number; leader: RawRowV2 | null }>();
  for (const row of rows) result.set(row, { penalty: 0, leader: null });

  const byDate = new Map<string, RawRowV2[]>();
  for (const row of rows) {
    if (isEvent.get(row)) continue;
    const list = byDate.get(row.departureDate);
    if (list) list.push(row);
    else byDate.set(row.departureDate, [row]);
  }

  for (const group of byDate.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (Math.abs(a.durationDays - b.durationDays) > DURATION_DIFF_MAX) continue;

        const sim = jaccardSimilarity(a.route, b.route);
        if (sim <= JACCARD_THRESHOLD) continue;

        const lfA = loadFactor(a);
        const lfB = loadFactor(b);
        const penalty = sim * CANNIBAL_PENALTY_FACTOR;
        const loser = lfA < lfB ? a : lfA > lfB ? b : null;
        const winner = loser === a ? b : loser === b ? a : null;
        if (!loser || !winner) continue;

        const current = result.get(loser)!;
        if (penalty > current.penalty) {
          result.set(loser, { penalty, leader: winner });
        }
      }
    }
  }

  return result;
}

function decide(lf: number, isEvent: boolean, cannibalPenalty: number, finalScore: number): { decision: DecisionV2; seoAction: SeoActionV2 } {
  if (lf < LF_HARD_STOP) return { decision: "FORCE_DELETE", seoAction: "NOINDEX" };
  if (isEvent && lf >= LF_EVENT_SUCCESS) return { decision: "KEEP_EVENT", seoAction: "MANUAL_SEO" };
  if (cannibalPenalty > 0 && finalScore < FINAL_SCORE_CANNIBAL) return { decision: "OPTIMIZE_CANNIBAL", seoAction: "CANONICAL" };
  if (finalScore >= FINAL_SCORE_LEADER) return { decision: "KEEP_LEADER", seoAction: "MANUAL_SEO" };
  return { decision: "REVISE", seoAction: "AUTO_TEMPLATE" };
}

export function analyzeV2(rows: RawRowV2[]): ReportV2 {
  const isEvent = computeEventFlags(rows);
  const penalties = computeCannibalPenalties(rows, isEvent);

  const verdicts: TourVerdictV2[] = rows.map((row) => {
    const lf = loadFactor(row);
    const event = isEvent.get(row) ?? false;
    const { penalty, leader } = penalties.get(row) ?? { penalty: 0, leader: null };
    const finalScore = lf - penalty;
    const { decision, seoAction } = decide(lf, event, penalty, finalScore);

    return {
      row,
      lf,
      season: seasonOf(row.departureDate),
      isEvent: event,
      cannibalPenalty: penalty,
      finalScore,
      decision,
      seoAction,
      canonicalTarget: decision === "OPTIMIZE_CANNIBAL" ? leader : null,
    };
  });

  // Критические даты: 2+ дублей с FORCE_DELETE/OPTIMIZE_CANNIBAL на одну дату.
  const dupCountByDate = new Map<string, number>();
  for (const v of verdicts) {
    if (v.decision !== "FORCE_DELETE" && v.decision !== "OPTIMIZE_CANNIBAL") continue;
    dupCountByDate.set(v.row.departureDate, (dupCountByDate.get(v.row.departureDate) ?? 0) + 1);
  }
  const criticalDates = [...dupCountByDate.entries()]
    .filter(([, count]) => count >= 2)
    .map(([date, duplicateCount]) => ({ date, duplicateCount }))
    .sort((a, b) => b.duplicateCount - a.duplicateCount || a.date.localeCompare(b.date));

  const focusAttention = verdicts
    .filter((v) => v.seoAction === "MANUAL_SEO")
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 5);

  return { rows: verdicts, criticalDates, focusAttention };
}
