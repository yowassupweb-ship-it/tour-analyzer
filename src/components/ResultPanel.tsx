"use client";

import { useMemo } from "react";
import type { CannibalPair, TourProduct } from "@/lib/types";

function opponentOf(pair: CannibalPair, productId: string): TourProduct {
  return pair.a.id === productId ? pair.b : pair.a;
}

function ZeroSalesCard({ p }: { p: TourProduct }) {
  const period = p.firstDate && p.lastDate ? `${p.firstDate} — ${p.lastDate}` : "даты неизвестны";
  return (
    <div
      className="rounded-[var(--radius-md)] p-4 flex flex-col gap-1.5"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-medium">{p.name}</span>
        <span
          className="tabular text-[12px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: "var(--status-critical)", background: "color-mix(in srgb, var(--status-critical) 16%, transparent)" }}
        >
          0 продаж
        </span>
      </div>
      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        #{p.id} · {p.route}
      </div>
      <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
        За {p.departures} {p.departures === 1 ? "отправление" : "отправлений"} ({period}) не продано ни одного места
        из {p.seats} доступных — заполняемость 0%. Тур ни разу не был куплен ни на одну из дат. Рекомендация: снять с
        продажи или пересмотреть маршрут/цену/дни отправления, прежде чем ставить в план снова.
      </p>
    </div>
  );
}

function CannibalizedCard({ product, matches }: { product: TourProduct; matches: CannibalPair[] }) {
  return (
    <div
      className="rounded-[var(--radius-md)] p-4 flex flex-col gap-1.5"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-medium">{product.name}</span>
        <span
          className="tabular text-[12px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 16%, transparent)" }}
        >
          {matches.length === 1 ? "1 конфликт" : `${matches.length} конфликта(ов)`}
        </span>
      </div>
      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        #{product.id} · {product.route}
      </div>
      <ul className="flex flex-col gap-1.5 mt-1">
        {matches.map((pair, i) => {
          const opponent = opponentOf(pair, product.id);
          const isVictim = pair.victim.id === product.id;
          const dateNote =
            pair.sharedDates > 0
              ? `${pair.sharedDates} из ${pair.minDepartures} общих дат отправления в один день`
              : `${pair.nearDates} отправлений в пределах ±2 дней от дат конкурента`;
          return (
            <li key={i} className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Конкурирует с «{opponent.name}» (#{opponent.id}): маршруты совпадают на {(pair.routeSim * 100).toFixed(0)}%,
              и у туров есть {dateNote} — в эти дни покупатель выбирает между двумя почти одинаковыми турами
              одновременно. У «{pair.survivor.name}» продано {pair.survivor.sold}, у «{pair.victim.name}» —{" "}
              {pair.victim.sold}.{" "}
              {pair.salesBasis ? (
                <span style={{ color: isVictim ? "var(--status-critical)" : "var(--status-good)", fontWeight: 600 }}>
                  {isVictim
                    ? `Рекомендация: снять «${product.name}» с продажи в эти даты или переработать — покупатель уже выбирает «${opponent.name}».`
                    : `Рекомендация: оставить «${product.name}», развести даты отправления либо снять «${opponent.name}».`}
                </span>
              ) : (
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                  Недостаточно оснований для выбора тура на снятие, нет продаж ни у одного из туров — решение нужно
                  принимать по другим критериям (цена, маршрут, сезон).
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LowSalesCard({ p }: { p: TourProduct }) {
  const period = p.firstDate && p.lastDate ? `${p.firstDate} — ${p.lastDate}` : "даты неизвестны";
  const unsold = p.seats - p.sold;
  return (
    <div
      className="rounded-[var(--radius-md)] p-4 flex flex-col gap-1.5"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-medium">{p.name}</span>
        <span
          className="tabular text-[12px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: "var(--status-serious)", background: "color-mix(in srgb, var(--status-serious) 16%, transparent)" }}
        >
          {(p.ratio * 100).toFixed(1)}% заполняемость
        </span>
      </div>
      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        #{p.id} · {p.route}
      </div>
      <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
        За {p.departures} {p.departures === 1 ? "отправление" : "отправлений"} ({period}) продано {p.sold} из{" "}
        {p.seats} мест — {unsold} мест простаивает, это самая дорогая проблема после нулевых продаж. Рекомендация:
        снизить цену, изменить даты отправления или объединить с более сильным туром на этом направлении.
      </p>
    </div>
  );
}

const LOW_SALES_DISPLAY_LIMIT = 20;

export function ResultPanel({
  products,
  cannibalPairs,
  lowSales,
}: {
  products: TourProduct[];
  cannibalPairs: CannibalPair[];
  lowSales: TourProduct[];
}) {
  // Ranked by wasted capacity (unsold seats), not an arbitrary order — that's
  // the number closest to actual lost revenue we can compute without prices.
  const zeroSales = useMemo(() => [...products.filter((p) => p.sold === 0)].sort((a, b) => b.seats - a.seats), [products]);

  const lowSalesRanked = useMemo(
    () => [...lowSales].sort((a, b) => b.seats - b.sold - (a.seats - a.sold)),
    [lowSales]
  );

  const cannibalized = useMemo(() => {
    // Exact same-day departures are the clearest conflict, but a departure a
    // day or two apart still competes for the same buyer — include both.
    const strongPairs = cannibalPairs.filter((p) => p.sharedDates > 0 || p.nearDates > 0);
    const byId = new Map<string, { product: TourProduct; matches: CannibalPair[] }>();
    for (const pair of strongPairs) {
      for (const product of [pair.a, pair.b]) {
        const entry = byId.get(product.id) ?? { product, matches: [] };
        entry.matches.push(pair);
        byId.set(product.id, entry);
      }
    }
    return [...byId.values()].sort((x, y) => {
      const impactOf = (entry: { product: TourProduct; matches: CannibalPair[] }) =>
        entry.matches.reduce((s, m) => s + m.sharedDates * 2 + m.nearDates, 0);
      return impactOf(y) - impactOf(x);
    });
  }, [cannibalPairs]);

  const nothingToShow = zeroSales.length === 0 && cannibalized.length === 0 && lowSalesRanked.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {nothingToShow && (
        <div className="card p-10 flex flex-col items-center gap-2 text-center">
          <span className="text-[15px] font-medium">Проблем не найдено</span>
          <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Нет туров с нулевыми или слабыми продажами и явной каннибализацией при текущих настройках порогов.
          </span>
        </div>
      )}

      {zeroSales.length > 0 && (
        <div className="card p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Снять с продажи — 0 продаж ({zeroSales.length})</h2>
            <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
              Ни разу не куплены ни на одну дату отправления
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {zeroSales.map((p) => (
              <ZeroSalesCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      )}

      {cannibalized.length > 0 && (
        <div className="card p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Пойманы на сильной каннибализации ({cannibalized.length})</h2>
            <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
              Отправляются в те же даты или в пределах ±2 дней от почти идентичного по маршруту тура
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {cannibalized.map(({ product, matches }) => (
              <CannibalizedCard key={product.id} product={product} matches={matches} />
            ))}
          </div>
        </div>
      )}

      {lowSalesRanked.length > 0 && (
        <div className="card p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Слабые продажи ({lowSalesRanked.length})</h2>
            <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
              Продавались, но ниже нижнего порога заполняемости — отсортированы по числу простаивающих мест
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {lowSalesRanked.slice(0, LOW_SALES_DISPLAY_LIMIT).map((p) => (
              <LowSalesCard key={p.id} p={p} />
            ))}
          </div>
          {lowSalesRanked.length > LOW_SALES_DISPLAY_LIMIT && (
            <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
              Показаны {LOW_SALES_DISPLAY_LIMIT} из {lowSalesRanked.length} — остальные см. на вкладке «Отчёт»
            </p>
          )}
        </div>
      )}
    </div>
  );
}
