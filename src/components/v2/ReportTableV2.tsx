"use client";

import { useMemo, useState } from "react";
import type { DecisionV2, SeoActionV2, TourVerdictV2 } from "@/lib/analyzeV2";

const DECISION_RU: Record<DecisionV2, string> = {
  FORCE_DELETE: "Удалить",
  KEEP_EVENT: "Оставить (событие)",
  OPTIMIZE_CANNIBAL: "Оптимизировать",
  KEEP_LEADER: "Оставить (лидер)",
  REVISE: "Пересмотреть",
  TOO_EARLY: "Рано судить",
};

const SEO_RU: Record<SeoActionV2, string> = {
  NOINDEX: "Скрыть из поиска",
  MANUAL_SEO: "Ручной SEO",
  CANONICAL: "Канонический URL",
  AUTO_TEMPLATE: "Авто-шаблон",
};

const DECISION_COLOR: Record<DecisionV2, string> = {
  FORCE_DELETE: "var(--status-critical)",
  KEEP_EVENT: "var(--status-good)",
  OPTIMIZE_CANNIBAL: "var(--status-warning)",
  KEEP_LEADER: "var(--status-good)",
  REVISE: "var(--text-muted)",
  TOO_EARLY: "var(--series-blue)",
};

const SEO_COLOR: Record<SeoActionV2, string> = {
  NOINDEX: "var(--status-critical)",
  MANUAL_SEO: "var(--status-good)",
  CANONICAL: "var(--status-warning)",
  AUTO_TEMPLATE: "var(--text-muted)",
};

// Russian reads first and larger — that's the actual decision a human acts
// on; the English enum rides underneath as the technical value (what
// actually gets written to the CMS field).
function Badge({ ruLabel, enLabel, color }: { ruLabel: string; enLabel: string; color: string }) {
  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className="text-[13px] font-semibold leading-tight" style={{ color }}>
        {ruLabel}
      </span>
      <span className="tabular text-[10px] font-medium uppercase tracking-wide leading-tight" style={{ color: "var(--text-muted)" }}>
        {enLabel}
      </span>
    </div>
  );
}

type SortKey = "tourId" | "routeName" | "departureDate" | "lf" | "decision";

const DECISION_RANK: Record<DecisionV2, number> = {
  FORCE_DELETE: 0,
  OPTIMIZE_CANNIBAL: 1,
  REVISE: 2,
  TOO_EARLY: 3,
  KEEP_LEADER: 4,
  KEEP_EVENT: 5,
};

export function ReportTableV2({ verdicts }: { verdicts: TourVerdictV2[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DecisionV2 | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("decision");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const rows = useMemo(() => {
    let list = verdicts;
    if (filter !== "all") list = list.filter((v) => v.decision === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (v) => v.row.routeName.toLowerCase().includes(q) || v.row.route.toLowerCase().includes(q) || v.row.tourId.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortKey === "tourId") return sortDir * a.row.tourId.localeCompare(b.row.tourId, "ru", { numeric: true });
      if (sortKey === "routeName") return sortDir * a.row.routeName.localeCompare(b.row.routeName, "ru");
      if (sortKey === "departureDate") return sortDir * a.row.departureDate.localeCompare(b.row.departureDate);
      if (sortKey === "lf") return sortDir * (a.lf - b.lf);
      return sortDir * (DECISION_RANK[a.decision] - DECISION_RANK[b.decision] || a.lf - b.lf);
    });
  }, [verdicts, query, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const headers: { key: SortKey; label: string }[] = [
    { key: "tourId", label: "ID тура" },
    { key: "routeName", label: "Название маршрута" },
    { key: "departureDate", label: "Дата выезда" },
    { key: "lf", label: "LF (%)" },
  ];

  return (
    // Full viewport width — same break-out treatment as the v1 results table.
    <div className="w-screen relative left-1/2 right-1/2 -mx-[50vw] px-4 sm:px-8">
      <div className="card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[15px] font-semibold">Блок 1. Сводная расчётная таблица ({rows.length})</h2>
            <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
              ID тура · Название маршрута · Дата выезда · LF (%) · Решение · SEO директива для CMS
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию, маршруту или ID"
              className="text-[13px] px-3 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)", color: "var(--text-primary)" }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as DecisionV2 | "all")}
              className="text-[13px] px-3 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)", color: "var(--text-primary)" }}
            >
              <option value="all">Все решения</option>
              <option value="FORCE_DELETE">{DECISION_RU.FORCE_DELETE} (FORCE_DELETE)</option>
              <option value="OPTIMIZE_CANNIBAL">{DECISION_RU.OPTIMIZE_CANNIBAL} (OPTIMIZE_CANNIBAL)</option>
              <option value="REVISE">{DECISION_RU.REVISE} (REVISE)</option>
              <option value="TOO_EARLY">{DECISION_RU.TOO_EARLY} (TOO_EARLY)</option>
              <option value="KEEP_LEADER">{DECISION_RU.KEEP_LEADER} (KEEP_LEADER)</option>
              <option value="KEEP_EVENT">{DECISION_RU.KEEP_EVENT} (KEEP_EVENT)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[13px] border-collapse table-fixed min-w-[900px]">
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                {headers.map((h) => (
                  <th
                    key={h.key}
                    onClick={() => toggleSort(h.key)}
                    className={`font-medium px-2 py-2 cursor-pointer select-none whitespace-nowrap ${
                      h.key === "routeName" ? "text-left" : "text-right"
                    }`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h.label}
                    {sortKey === h.key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                  </th>
                ))}
                <th
                  onClick={() => toggleSort("decision")}
                  className="text-left font-medium px-2 py-2 cursor-pointer select-none whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Решение{sortKey === "decision" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </th>
                <th className="text-left font-medium px-2 py-2" style={{ color: "var(--text-muted)" }}>
                  SEO директива
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => (
                <tr key={`${v.row.tourId}-${v.row.departureDate}-${i}`} style={{ borderBottom: "1px solid var(--gridline)" }}>
                  <td className="tabular px-2 py-2 text-right">{v.row.tourId}</td>
                  <td className="px-2 py-2 min-w-0">
                    <div className="truncate font-medium">{v.row.routeName}</div>
                    <div className="truncate text-[12px]" style={{ color: "var(--text-muted)" }} title={v.row.route}>
                      {v.row.route} · {v.row.durationDays} дн. · {v.season}
                      {v.isEvent ? " · событие" : ""}
                    </div>
                  </td>
                  <td className="tabular px-2 py-2 text-right whitespace-nowrap">{v.row.departureDate}</td>
                  <td className="tabular px-2 py-2 text-right font-medium">{(v.lf * 100).toFixed(1)}%</td>
                  <td className="px-2 py-2">
                    <Badge ruLabel={DECISION_RU[v.decision]} enLabel={v.decision} color={DECISION_COLOR[v.decision]} />
                  </td>
                  <td className="px-2 py-2">
                    <Badge ruLabel={SEO_RU[v.seoAction]} enLabel={v.seoAction} color={SEO_COLOR[v.seoAction]} />
                    {v.canonicalTarget && (
                      <span className="text-[12px] block mt-0.5" style={{ color: "var(--text-muted)" }}>
                        → #{v.canonicalTarget.tourId}
                      </span>
                    )}
                  </td>
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
    </div>
  );
}
