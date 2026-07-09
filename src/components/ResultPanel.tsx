"use client";

import { useMemo, useState } from "react";
import type { Recommendation, TourProduct, TourVerdict } from "@/lib/types";
import { StatTile } from "@/components/StatTile";
import { Tabs } from "@/components/Tabs";

const REC_LABEL: Record<Recommendation, string> = {
  keep: "Оставить",
  remove_zero: "Удалить — нет продаж",
  remove_cannibal: "Удалить — каннибализация",
};

const REC_COLOR: Record<Recommendation, string> = {
  keep: "var(--status-good)",
  remove_zero: "var(--status-critical)",
  remove_cannibal: "var(--status-warning)",
};

function RecBadge({ recommendation }: { recommendation: Recommendation }) {
  const color = REC_COLOR[recommendation];
  return (
    <span
      className="text-[12px] font-semibold px-2 py-0.5 rounded-full inline-block whitespace-nowrap"
      style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      {REC_LABEL[recommendation]}
    </span>
  );
}

function ClusterCard({ members, verdictById }: { members: TourProduct[]; verdictById: Map<string, TourVerdict> }) {
  const sorted = [...members].sort((a, b) => b.sold - a.sold || b.ratio - a.ratio || b.seats - a.seats);
  return (
    <div
      className="rounded-[var(--radius-md)] p-4 flex flex-col gap-3"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
          Группа из {members.length} туров
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((p) => {
          const verdict = verdictById.get(p.id);
          if (!verdict) return null;
          return (
            <div key={p.id} className="rounded-[var(--radius-sm)] p-3" style={{ background: "var(--surface-1)" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-medium">{p.name}</span>
                <RecBadge recommendation={verdict.recommendation} />
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                #{p.id} · {p.route}
              </div>
              <div className="tabular text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Продано {p.sold} из {p.seats} мест ({(p.ratio * 100).toFixed(1)}%)
              </div>
              <p className="text-[13px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
                {verdict.reason}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StandaloneCard({ verdict }: { verdict: TourVerdict }) {
  const p = verdict.product;
  return (
    <div
      className="rounded-[var(--radius-md)] p-4 flex flex-col gap-1.5"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-medium">{p.name}</span>
        <RecBadge recommendation={verdict.recommendation} />
      </div>
      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        #{p.id} · {p.route}
      </div>
      <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
        {verdict.reason}
      </p>
    </div>
  );
}

type SortKey = "name" | "sold" | "seats" | "ratio" | "recommendation";

const RANK: Record<Recommendation, number> = { remove_cannibal: 0, remove_zero: 1, keep: 2 };

type ViewMode = "insights" | "table";

export function ResultPanel({ verdicts }: { verdicts: TourVerdict[] }) {
  const [view, setView] = useState<ViewMode>("insights");
  const [filter, setFilter] = useState<Recommendation | "all">("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recommendation");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const verdictById = useMemo(() => new Map(verdicts.map((v) => [v.product.id, v])), [verdicts]);

  const clusters = useMemo(() => {
    const byId = new Map<string, TourProduct[]>();
    for (const v of verdicts) {
      if (!v.clusterId || v.clusterMembers.length < 2) continue;
      if (!byId.has(v.clusterId)) byId.set(v.clusterId, v.clusterMembers);
    }
    return [...byId.values()].sort((a, b) => {
      const soldOf = (members: TourProduct[]) => members.reduce((s, m) => s + m.sold, 0);
      return soldOf(b) - soldOf(a);
    });
  }, [verdicts]);

  const standaloneRemoveZero = useMemo(
    () =>
      verdicts
        .filter((v) => v.recommendation === "remove_zero")
        .sort((a, b) => b.product.seats - a.product.seats),
    [verdicts]
  );

  const counts = useMemo(() => {
    const c: Record<Recommendation, number> = { keep: 0, remove_zero: 0, remove_cannibal: 0 };
    for (const v of verdicts) c[v.recommendation]++;
    return c;
  }, [verdicts]);

  const fullList = useMemo(() => {
    let list = verdicts;
    if (filter !== "all") list = list.filter((v) => v.recommendation === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (v) => v.product.name.toLowerCase().includes(q) || v.product.route.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortKey === "name") return sortDir * a.product.name.localeCompare(b.product.name, "ru");
      if (sortKey === "recommendation") {
        return sortDir * (RANK[a.recommendation] - RANK[b.recommendation] || b.product.sold - a.product.sold);
      }
      return sortDir * (b.product[sortKey] - a.product[sortKey]);
    });
  }, [verdicts, filter, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const headers: { key: SortKey; label: string }[] = [
    { key: "name", label: "Тур" },
    { key: "seats", label: "Мест" },
    { key: "sold", label: "Продано" },
    { key: "ratio", label: "% продаж" },
    { key: "recommendation", label: "Решение" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Всего туров" value={String(verdicts.length)} />
        <StatTile label="Оставить" value={String(counts.keep)} tone="good" />
        <StatTile
          label="Удалить"
          value={String(counts.remove_zero + counts.remove_cannibal)}
          hint={`${counts.remove_zero} без продаж · ${counts.remove_cannibal} каннибализация`}
          tone="critical"
        />
      </div>

      <Tabs
        tabs={[
          { key: "insights", label: "Выводы" },
          { key: "table", label: "Таблица" },
        ]}
        active={view}
        onChange={setView}
      />

      {view === "insights" && (
        <>
          {clusters.length === 0 && standaloneRemoveZero.length === 0 && (
            <div className="card p-10 flex flex-col items-center gap-2 text-center">
              <span className="text-[15px] font-medium">Проблем не найдено</span>
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                Нет групп каннибализации и туров без продаж при текущих настройках порогов.
              </span>
            </div>
          )}

          {clusters.length > 0 && (
            <div className="card p-6 flex flex-col gap-4">
              <div>
                <h2 className="text-[15px] font-semibold">Группы каннибализации — кого оставить ({clusters.length})</h2>
                <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Туры сгруппированы по пересечению дат отправления и схожести маршрута. Внутри группы оставлен тур с
                  наибольшими продажами, остальные — кандидаты на удаление.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {clusters.map((members) => (
                  <ClusterCard key={members.map((m) => m.id).join(",")} members={members} verdictById={verdictById} />
                ))}
              </div>
            </div>
          )}

          {standaloneRemoveZero.length > 0 && (
            <div className="card p-6 flex flex-col gap-4">
              <div>
                <h2 className="text-[15px] font-semibold">Без продаж, вне групп каннибализации ({standaloneRemoveZero.length})</h2>
                <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Ни разу не куплены, и конкурирующего тура на эти же даты не найдено — проблема в спросе, а не в
                  конкуренции с другим туром
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {standaloneRemoveZero.map((v) => (
                  <StandaloneCard key={v.product.id} verdict={v} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {view === "table" && (
        // Break out of the page's centered max-w-6xl column — this table has
        // six columns plus a free-text reason and reads far better with the
        // full viewport width than boxed into the narrower report column.
        <div className="w-screen relative left-1/2 right-1/2 -mx-[50vw] px-4 sm:px-8">
        <div className="card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[15px] font-semibold">Полный список туров ({fullList.length})</h2>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                Что было и что с этим делать — по каждому туру
              </p>
            </div>
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
                onChange={(e) => setFilter(e.target.value as Recommendation | "all")}
                className="text-[13px] px-3 py-1.5 rounded-lg outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)", color: "var(--text-primary)" }}
              >
                <option value="all">Все решения</option>
                <option value="keep">Оставить</option>
                <option value="remove_cannibal">Удалить — каннибализация</option>
                <option value="remove_zero">Удалить — нет продаж</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-[13px] border-collapse table-fixed min-w-[820px]">
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                  {headers.map((h) => (
                    <th
                      key={h.key}
                      onClick={() => toggleSort(h.key)}
                      className={`font-medium px-2 py-2 cursor-pointer select-none whitespace-nowrap ${
                        h.key === "name" ? "text-left" : "text-right"
                      }`}
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h.label}
                      {sortKey === h.key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                  <th className="text-left font-medium px-2 py-2" style={{ color: "var(--text-muted)" }}>
                    Причина
                  </th>
                </tr>
              </thead>
              <tbody>
                {fullList.map((v) => (
                  <tr key={v.product.id} style={{ borderBottom: "1px solid var(--gridline)" }}>
                    <td className="px-2 py-2 min-w-0">
                      <div className="truncate font-medium">{v.product.name}</div>
                      <div className="truncate text-[12px]" style={{ color: "var(--text-muted)" }} title={v.product.route}>
                        #{v.product.id} · {v.product.route}
                      </div>
                    </td>
                    <td className="tabular px-2 py-2 text-right">{v.product.seats}</td>
                    <td className="tabular px-2 py-2 text-right">{v.product.sold}</td>
                    <td className="tabular px-2 py-2 text-right font-medium">{(v.product.ratio * 100).toFixed(1)}%</td>
                    <td className="px-2 py-2 text-right">
                      <RecBadge recommendation={v.recommendation} />
                    </td>
                    <td className="relative group px-2 py-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      <span
                        className="line-clamp-2 cursor-help underline decoration-dotted underline-offset-2"
                        style={{ textDecorationColor: "var(--text-muted)" }}
                      >
                        {v.reason}
                      </span>
                      <div
                        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute z-30 right-0 top-full mt-2 w-96 max-w-[85vw] rounded-[var(--radius-md)] p-4 text-[13px] leading-relaxed"
                        style={{
                          background: "var(--surface-1)",
                          border: "1px solid var(--border-hairline)",
                          color: "var(--text-secondary)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                        }}
                      >
                        {v.reason}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fullList.length === 0 && (
              <p className="text-center py-8 text-[13px]" style={{ color: "var(--text-muted)" }}>
                Ничего не найдено
              </p>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
