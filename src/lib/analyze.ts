import { familyKey } from "./normalize";
import { diceSimilarity } from "./similarity";
import type {
  AnalysisResult,
  CannibalPair,
  PerformanceTier,
  RawRow,
  Thresholds,
  TourProduct,
  TourVerdict,
} from "./types";

export const DEFAULT_THRESHOLDS: Thresholds = {
  lowMax: 0.1,
  mediumMax: 0.3,
  similarityMin: 0.7,
};

function buildProducts(rows: RawRow[]): {
  products: TourProduct[];
  inconsistentIds: { id: string; names: string[]; routes: string[] }[];
} {
  const byId = new Map<string, RawRow[]>();
  for (const row of rows) {
    const bucket = byId.get(row.tourNo);
    if (bucket) bucket.push(row);
    else byId.set(row.tourNo, [row]);
  }

  const products: TourProduct[] = [];
  const inconsistentIds: { id: string; names: string[]; routes: string[] }[] = [];

  for (const [id, group] of byId) {
    const names = [...new Set(group.map((r) => r.name))];
    const routes = [...new Set(group.map((r) => r.route))];
    if (names.length > 1 || routes.length > 1) {
      inconsistentIds.push({ id, names, routes });
    }

    const seats = group.reduce((s, r) => s + r.seats, 0);
    const sold = group.reduce((s, r) => s + r.sold, 0);
    const dates = group.map((r) => r.date).filter((d): d is string => !!d).sort();

    const name = names[0] ?? "";

    products.push({
      id,
      name,
      route: routes[0] ?? "",
      departures: group.length,
      seats,
      sold,
      ratio: seats > 0 ? sold / seats : 0,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      rows: group,
      familyKey: familyKey(name),
    });
  }

  products.sort((a, b) => b.ratio - a.ratio);
  return { products, inconsistentIds };
}

function tierOf(product: TourProduct, thresholds: Thresholds): PerformanceTier {
  if (product.sold === 0) return "none";
  if (product.ratio <= thresholds.lowMax) return "low";
  if (product.ratio <= thresholds.mediumMax) return "medium";
  return "good";
}

function sharedDateCount(a: TourProduct, b: TourProduct): number {
  const datesA = new Set(a.rows.map((r) => r.date).filter((d): d is string => !!d));
  let shared = 0;
  for (const row of b.rows) {
    if (row.date && datesA.has(row.date)) shared++;
  }
  return shared;
}

const NEAR_DATE_WINDOW_DAYS = 2;

function toDayIndex(dateStr: string): number | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

// A buyer deciding a week out doesn't only compare tours leaving on the exact
// same day — departures a day or two apart still compete for the same trip
// window. This catches that softer, more realistic overlap without counting
// dates already flagged as an exact match.
function nearDateCount(a: TourProduct, b: TourProduct, windowDays = NEAR_DATE_WINDOW_DAYS): number {
  const datesA = [...new Set(a.rows.map((r) => r.date).filter((d): d is string => !!d))]
    .map(toDayIndex)
    .filter((d): d is number => d !== null);
  const datesB = [...new Set(b.rows.map((r) => r.date).filter((d): d is string => !!d))];
  let near = 0;
  for (const dateStr of datesB) {
    const day = toDayIndex(dateStr);
    if (day === null) continue;
    const isExact = datesA.includes(day);
    if (isExact) continue;
    const isNear = datesA.some((da) => Math.abs(da - day) <= windowDays);
    if (isNear) near++;
  }
  return near;
}

// When two tours cannibalize each other, the one with more actual sales is the
// one the buyer is already choosing — that's the survivor. Ratio and seats are
// only tie-breakers for when sold is equal (e.g. both zero).
function pickSurvivor(a: TourProduct, b: TourProduct): { survivor: TourProduct; victim: TourProduct } {
  if (a.sold !== b.sold) return a.sold > b.sold ? { survivor: a, victim: b } : { survivor: b, victim: a };
  if (a.ratio !== b.ratio) return a.ratio > b.ratio ? { survivor: a, victim: b } : { survivor: b, victim: a };
  if (a.seats !== b.seats) return a.seats > b.seats ? { survivor: a, victim: b } : { survivor: b, victim: a };
  return { survivor: a, victim: b };
}

// Cannibalization signal: a near-identical route that also departs on the same
// dates is the clearest sign two products compete for the same buyer, so shared
// dates rank first regardless of anything else.
//
// "Matryoshka" pairs are excluded outright, not scored: when the name differs
// only by its trailing number, that number is the trip length in days (e.g.
// "Брестская кругосветка - 5" vs "- 4"), so the two are editions of one same
// tour — pieces of it, not competitors — and can never cannibalize each other.
function findCannibalPairs(products: TourProduct[], similarityMin: number): CannibalPair[] {
  const pairs: CannibalPair[] = [];
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i];
      const b = products[j];
      const isMatryoshka = a.familyKey.length > 0 && a.familyKey === b.familyKey;
      if (isMatryoshka) continue;

      const routeSim = diceSimilarity(a.route, b.route);
      if (routeSim >= similarityMin) {
        const { survivor, victim } = pickSurvivor(a, b);
        pairs.push({
          a,
          b,
          routeSim,
          score: routeSim,
          sharedDates: sharedDateCount(a, b),
          nearDates: nearDateCount(a, b),
          minDepartures: Math.min(a.departures, b.departures),
          survivor,
          victim,
          // Sold count is the only real evidence of which tour the buyer
          // prefers. If it's tied (both zero, or equal nonzero), ratio/seats
          // tie-breaks are arbitrary — there is no basis to say who to cut.
          salesBasis: a.sold !== b.sold,
        });
      }
    }
  }
  // Among equally strong conflicts, surface the ones where the victim still has
  // the most sales at stake first — that's where fixing the conflict matters most.
  return pairs.sort(
    (x, y) =>
      y.sharedDates - x.sharedDates ||
      y.nearDates - x.nearDates ||
      y.score - x.score ||
      y.victim.sold - x.victim.sold
  );
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function pluralDepartures(n: number): string {
  return n === 1 ? "отправление" : "отправлений";
}

// Two tours can each show up as the closest competitor of a third without
// directly overlapping themselves (A~B, B~C). Union-Find turns those chains
// into one cluster, because they're really all fighting over the same slice
// of buyers — keeping the single best seller and cutting the rest is a
// cleaner call than deciding pair by pair.
function buildClusters(products: TourProduct[], pairs: CannibalPair[]): Map<string, TourProduct[]> {
  const parent = new Map<string, string>();
  for (const p of products) parent.set(p.id, p.id);

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  }
  function union(x: string, y: string) {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  }

  // Only exact or near date overlap is treated as real, actionable
  // competition — a route-text match alone (no date overlap at all) doesn't
  // put two tours in front of the same buyer on the same trip.
  for (const pair of pairs) {
    if (pair.sharedDates > 0 || pair.nearDates > 0) union(pair.a.id, pair.b.id);
  }

  const clusters = new Map<string, TourProduct[]>();
  for (const p of products) {
    const root = find(p.id);
    const list = clusters.get(root);
    if (list) list.push(p);
    else clusters.set(root, [p]);
  }
  return clusters;
}

function pickBestOfCluster(members: TourProduct[]): TourProduct {
  return members.reduce((best, next) => {
    const { survivor } = pickSurvivor(best, next);
    return survivor;
  });
}

// The full keep/remove call for every tour: group whatever cannibalizes each
// other into clusters and name the best seller in each the one to keep; a
// standalone tour with zero sales is cut for lack of demand, not competition;
// everything else is fine as-is.
//
// Losing the comparison inside a cluster isn't itself grounds for cutting a
// tour — "Замковая кругосветка" outselling "Белорусский калейдоскоп" 22 to 16
// doesn't mean the 16 is a dud, both are healthy. Only recommend removal for
// a cluster's non-leader if its own sell-through is genuinely weak (tier
// "none"/"low" on its own merits) — otherwise both are worth keeping and the
// fix is to spread out departure dates, not cut one.
function buildVerdicts(products: TourProduct[], pairs: CannibalPair[], thresholds: Thresholds): TourVerdict[] {
  const clusters = buildClusters(products, pairs);

  const membersById = new Map<string, { root: string; members: TourProduct[] }>();
  for (const [root, members] of clusters) {
    for (const member of members) membersById.set(member.id, { root, members });
  }

  return products.map((p): TourVerdict => {
    const { root, members } = membersById.get(p.id) ?? { root: p.id, members: [p] };

    if (members.length > 1) {
      const survivor = pickBestOfCluster(members);
      const rivalNames = members.filter((m) => m.id !== p.id).map((m) => m.name);

      if (p.id === survivor.id) {
        const zeroCaveat =
          p.sold === 0
            ? " Продаж пока нет ни у одного тура в группе — оцените, стоит ли сохранять направление вообще."
            : "";
        return {
          product: p,
          recommendation: "keep",
          reason: `Лидер среди ${members.length} похожих туров, конкурирующих за одни даты (${rivalNames.join(
            ", "
          )}). Продано ${p.sold} из ${p.seats} мест (${formatPct(p.ratio)}) — больше, чем у конкурентов.${zeroCaveat} Рекомендация: оставить как основной вариант, остальные из группы снять или объединить с этим туром.`,
          clusterId: root,
          clusterMembers: members,
          keptInstead: null,
        };
      }

      const ownTier = tierOf(p, thresholds);
      if (ownTier === "medium" || ownTier === "good") {
        return {
          product: p,
          recommendation: "keep",
          reason: `Конкурирует за тех же покупателей с «${survivor.name}» (#${survivor.id}, ${survivor.sold} продаж), но продажи у этого тура тоже в норме: ${p.sold} из ${p.seats} мест (${formatPct(
            p.ratio
          )}). Меньше, чем у «${survivor.name}», не значит слабо — оснований для удаления нет. Рекомендация: оставить оба, по возможности развести даты отправления, чтобы не пересекались.`,
          clusterId: root,
          clusterMembers: members,
          keptInstead: null,
        };
      }

      return {
        product: p,
        recommendation: "remove_cannibal",
        reason: `Конкурирует за тех же покупателей с «${survivor.name}» (#${survivor.id}), у которого больше продаж: ${survivor.sold} из ${survivor.seats} мест (${formatPct(
          survivor.ratio
        )}) против ${p.sold} из ${p.seats} (${formatPct(p.ratio)}) у этого тура — заполняемость слишком низкая, чтобы держать оба. Рекомендация: снять с продажи или объединить с «${survivor.name}».`,
        clusterId: root,
        clusterMembers: members,
        keptInstead: survivor,
      };
    }

    if (p.sold === 0) {
      const period = p.firstDate && p.lastDate ? `${p.firstDate} — ${p.lastDate}` : "даты неизвестны";
      return {
        product: p,
        recommendation: "remove_zero",
        reason: `За ${p.departures} ${pluralDepartures(p.departures)} (${period}) не продано ни одного места из ${p.seats} доступных. Конкурирующих туров на те же даты не найдено — проблема не в каннибализации, а в отсутствии спроса. Рекомендация: снять с продажи или пересмотреть маршрут/цену.`,
        clusterId: null,
        clusterMembers: [p],
        keptInstead: null,
      };
    }

    return {
      product: p,
      recommendation: "keep",
      reason: `Продаётся без конфликтов: ${p.sold} из ${p.seats} мест (${formatPct(
        p.ratio
      )}), туров с пересечением дат и похожим маршрутом не найдено.`,
      clusterId: null,
      clusterMembers: [p],
      keptInstead: null,
    };
  });
}

export function analyze(rows: RawRow[], thresholds: Thresholds = DEFAULT_THRESHOLDS): AnalysisResult {
  const { products, inconsistentIds } = buildProducts(rows);

  const uniqueNameRoutePairs = new Set(products.map((p) => `${p.name} ${p.route}`)).size;

  const tiers: Record<PerformanceTier, TourProduct[]> = { none: [], low: [], medium: [], good: [] };
  for (const product of products) {
    tiers[tierOf(product, thresholds)].push(product);
  }

  const cannibalPairs = findCannibalPairs(products, thresholds.similarityMin);
  const verdicts = buildVerdicts(products, cannibalPairs, thresholds);

  const totals = products.reduce(
    (acc, p) => ({ seats: acc.seats + p.seats, sold: acc.sold + p.sold }),
    { seats: 0, sold: 0 }
  );

  return {
    rawRowCount: rows.length,
    products,
    uniqueIds: products.length,
    uniqueNameRoutePairs,
    inconsistentIds,
    tiers,
    cannibalPairs,
    verdicts,
    thresholds,
    totals,
  };
}
