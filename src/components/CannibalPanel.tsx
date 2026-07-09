"use client";

import { useMemo, useState } from "react";
import type { CannibalPair } from "@/lib/types";

type SortKey = "score" | "sharedDates" | "a" | "b";

export function CannibalPanel({ pairs }: { pairs: CannibalPair[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("sharedDates");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    let list = pairs;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.a.name.toLowerCase().includes(q) ||
          p.b.name.toLowerCase().includes(q) ||
          p.a.route.toLowerCase().includes(q) ||
          p.b.route.toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((x, y) => {
      if (sortKey === "score") return sortDir * (x.score - y.score);
      if (sortKey === "sharedDates") return sortDir * (x.sharedDates - y.sharedDates);
      if (sortKey === "a") return sortDir * x.a.name.localeCompare(y.a.name, "ru");
      return sortDir * x.b.name.localeCompare(y.b.name, "ru");
    });
    return sorted;
  }, [pairs, query, sortKey, sortDir]);

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
        <div>
          <h2 className="text-[15px] font-semibold">
            Кто кого каннибализирует ({pairs.length} {pairs.length === 1 ? "пара" : "пар"})
          </h2>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
            Признаки: совпадающие даты отправления (явная каннибализация) · отправления в пределах ±2 дней (мягкая
            каннибализация — покупатель всё ещё выбирает между ними) · схожесть маршрута. Туры, отличающиеся в
            названии только числом дней (одна и та же поездка разной длительности), в список не попадают.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию или маршруту"
          className="text-[13px] px-3 py-1.5 rounded-lg outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)", color: "var(--text-primary)" }}
        />
      </div>

      {pairs.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          При текущем пороге похожести маршрутов совпадений не найдено. Понизьте порог в настройках анализа.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[13px] border-collapse table-fixed min-w-[960px]">
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                <th
                  onClick={() => toggleSort("a")}
                  className="text-left font-medium px-2 py-2 cursor-pointer select-none"
                  style={{ color: "var(--text-muted)" }}
                >
                  Тур 1{sortKey === "a" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </th>
                <th
                  onClick={() => toggleSort("b")}
                  className="text-left font-medium px-2 py-2 cursor-pointer select-none"
                  style={{ color: "var(--text-muted)" }}
                >
                  Тур 2{sortKey === "b" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </th>
                <th
                  onClick={() => toggleSort("score")}
                  className="text-right font-medium px-2 py-2 cursor-pointer select-none whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  % схожести маршрута{sortKey === "score" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </th>
                <th
                  onClick={() => toggleSort("sharedDates")}
                  className="text-right font-medium px-2 py-2 cursor-pointer select-none whitespace-nowrap"
                  style={{ color: "var(--text-muted)" }}
                >
                  Совпадения по датам{sortKey === "sharedDates" ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                </th>
                <th className="text-left font-medium px-2 py-2" style={{ color: "var(--text-muted)" }}>
                  Рекомендация
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pair, i) => {
                const exact = pair.sharedDates > 0;
                const near = pair.nearDates > 0;
                const explicit = exact || near;
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid var(--gridline)",
                      background: exact
                        ? "color-mix(in srgb, var(--status-critical) 6%, transparent)"
                        : near
                        ? "color-mix(in srgb, var(--status-warning) 6%, transparent)"
                        : undefined,
                    }}
                  >
                    <td className="px-2 py-2 min-w-0">
                      <div className="truncate font-medium">{pair.a.name}</div>
                      <div className="truncate text-[12px]" style={{ color: "var(--text-muted)" }} title={pair.a.route}>
                        #{pair.a.id} · {pair.a.route}
                      </div>
                    </td>
                    <td className="px-2 py-2 min-w-0">
                      <div className="truncate font-medium">{pair.b.name}</div>
                      <div className="truncate text-[12px]" style={{ color: "var(--text-muted)" }} title={pair.b.route}>
                        #{pair.b.id} · {pair.b.route}
                      </div>
                    </td>
                    <td className="tabular px-2 py-2 text-right font-medium" style={{ color: "var(--series-blue)" }}>
                      {(pair.score * 100).toFixed(0)}%
                    </td>
                    <td className="px-2 py-2 text-right">
                      {exact && (
                        <span
                          className="tabular text-[12px] font-semibold px-2 py-0.5 rounded-full inline-block"
                          style={{ color: "var(--status-critical)", background: "color-mix(in srgb, var(--status-critical) 16%, transparent)" }}
                          title="Явная каннибализация: отправления в один день"
                        >
                          {pair.sharedDates} из {pair.minDepartures} в один день
                        </span>
                      )}
                      {near && (
                        <span
                          className="tabular text-[12px] font-semibold px-2 py-0.5 rounded-full inline-block ml-1"
                          style={{ color: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 16%, transparent)" }}
                          title="Мягкая каннибализация: отправления в пределах ±2 дней"
                        >
                          {pair.nearDates} рядом (±2 дня)
                        </span>
                      )}
                      {!explicit && (
                        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 min-w-0">
                      {!explicit ? (
                        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          —
                        </span>
                      ) : pair.salesBasis ? (
                        <div className="text-[12px] leading-snug">
                          <div style={{ color: "var(--status-good)" }}>
                            Оставить: <span className="font-medium">{pair.survivor.name}</span> ({pair.survivor.sold} продано)
                          </div>
                          <div style={{ color: "var(--status-critical)" }}>
                            Снять: <span className="font-medium">{pair.victim.name}</span> ({pair.victim.sold} продано)
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          Недостаточно оснований для выбора тура на снятие, нет продаж
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-center py-8 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Ничего не найдено
            </p>
          )}
        </div>
      )}
    </div>
  );
}
