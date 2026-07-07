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
          return (
            <li key={i} className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Конкурирует с «{opponent.name}» (#{opponent.id}): маршруты совпадают на {(pair.routeSim * 100).toFixed(0)}%,
              и у обоих туров есть {pair.sharedDates} из {pair.minDepartures} общих дат отправления — в эти дни
              покупатель выбирает между двумя почти одинаковыми турами одновременно. Рекомендация: развести даты
              отправления либо объединить программы в один тур.
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ResultPanel({ products, cannibalPairs }: { products: TourProduct[]; cannibalPairs: CannibalPair[] }) {
  const zeroSales = useMemo(() => [...products.filter((p) => p.sold === 0)].sort((a, b) => b.seats - a.seats), [products]);

  const cannibalized = useMemo(() => {
    const strongPairs = cannibalPairs.filter((p) => p.sharedDates > 0);
    const byId = new Map<string, { product: TourProduct; matches: CannibalPair[] }>();
    for (const pair of strongPairs) {
      for (const product of [pair.a, pair.b]) {
        const entry = byId.get(product.id) ?? { product, matches: [] };
        entry.matches.push(pair);
        byId.set(product.id, entry);
      }
    }
    return [...byId.values()].sort((x, y) => {
      const totalX = x.matches.reduce((s, m) => s + m.sharedDates, 0);
      const totalY = y.matches.reduce((s, m) => s + m.sharedDates, 0);
      return totalY - totalX;
    });
  }, [cannibalPairs]);

  const nothingToShow = zeroSales.length === 0 && cannibalized.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {nothingToShow && (
        <div className="card p-10 flex flex-col items-center gap-2 text-center">
          <span className="text-[15px] font-medium">Проблем не найдено</span>
          <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Нет туров с нулевыми продажами и явной каннибализацией при текущих настройках порогов.
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
              Отправляются в те же даты, что и почти идентичный по маршруту тур
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {cannibalized.map(({ product, matches }) => (
              <CannibalizedCard key={product.id} product={product} matches={matches} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
