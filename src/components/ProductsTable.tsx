"use client";

import { useMemo, useState } from "react";
import type { PerformanceTier, TourProduct } from "@/lib/types";

const TIER_LABEL: Record<PerformanceTier, string> = {
  good: "Хорошо",
  medium: "Средне",
  low: "Слабо",
  none: "Не продавался",
};

const TIER_COLOR: Record<PerformanceTier, string> = {
  good: "var(--status-good)",
  medium: "var(--status-warning)",
  low: "var(--status-serious)",
  none: "var(--status-critical)",
};

type SortKey = "name" | "departures" | "seats" | "sold" | "ratio";

function tierBadge(tier: PerformanceTier) {
  return (
    <span
      className="text-[12px] font-medium px-2 py-0.5 rounded-full inline-block"
      style={{
        color: TIER_COLOR[tier],
        background: `color-mix(in srgb, ${TIER_COLOR[tier]} 14%, transparent)`,
      }}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

function tierOf(p: TourProduct, lowMax: number, mediumMax: number): PerformanceTier {
  if (p.sold === 0) return "none";
  if (p.ratio <= lowMax) return "low";
  if (p.ratio <= mediumMax) return "medium";
  return "good";
}

const HEADERS: { key: SortKey; label: string; align: "left" | "right"; width: string }[] = [
  { key: "name", label: "Тур", align: "left", width: "40%" },
  { key: "departures", label: "Отправлений", align: "right", width: "13%" },
  { key: "seats", label: "Мест", align: "right", width: "11%" },
  { key: "sold", label: "Продано", align: "right", width: "11%" },
  { key: "ratio", label: "% продаж", align: "right", width: "11%" },
];

export function ProductsTable({
  products,
  lowMax,
  mediumMax,
}: {
  products: TourProduct[];
  lowMax: number;
  mediumMax: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("ratio");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [filter, setFilter] = useState<PerformanceTier | "all">("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    let list = products.map((p) => ({ p, tier: tierOf(p, lowMax, mediumMax) }));
    if (filter !== "all") list = list.filter((r) => r.tier === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => r.p.name.toLowerCase().includes(q) || r.p.route.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortKey === "name") return sortDir * a.p.name.localeCompare(b.p.name, "ru");
      const av = a.p[sortKey];
      const bv = b.p[sortKey];
      return sortDir * ((av as number) - (bv as number));
    });
    return list;
  }, [products, filter, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold">Все туры ({products.length})</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию или маршруту"
            className="text-[13px] px-3 py-1.5 rounded-lg outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)", color: "var(--text-primary)" }}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as PerformanceTier | "all")}
            className="text-[13px] px-3 py-1.5 rounded-lg outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)", color: "var(--text-primary)" }}
          >
            <option value="all">Все категории</option>
            <option value="good">Хорошо</option>
            <option value="medium">Средне</option>
            <option value="low">Слабо</option>
            <option value="none">Не продавался</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-[13px] border-collapse table-fixed min-w-[720px]">
          <colgroup>
            {HEADERS.map((h) => (
              <col key={h.key} style={{ width: h.width }} />
            ))}
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  onClick={() => toggleSort(h.key)}
                  className={`font-medium px-2 py-2 cursor-pointer select-none whitespace-nowrap ${
                    h.align === "right" ? "text-right" : "text-left"
                  }`}
                  style={{ color: "var(--text-muted)" }}
                >
                  {h.label}
                  {sortKey === h.key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="text-left font-medium px-2 py-2" style={{ color: "var(--text-muted)" }}>
                Статус
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, tier }) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--gridline)" }}>
                <td className="px-2 py-2 min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate text-[12px]" style={{ color: "var(--text-muted)" }} title={p.route}>
                    {p.route}
                  </div>
                </td>
                <td className="tabular px-2 py-2 text-right">{p.departures}</td>
                <td className="tabular px-2 py-2 text-right">{p.seats}</td>
                <td className="tabular px-2 py-2 text-right">{p.sold}</td>
                <td className="tabular px-2 py-2 text-right font-medium">{(p.ratio * 100).toFixed(1)}%</td>
                <td className="px-2 py-2">{tierBadge(tier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center py-8 text-[13px]" style={{ color: "var(--text-muted)" }}>
            Ничего не найдено
          </p>
        )}
      </div>
    </div>
  );
}
