import type { TourProduct } from "@/lib/types";

export function SellersChart({ products }: { products: TourProduct[] }) {
  const top = products.filter((p) => p.sold > 0).slice(0, 8);
  const maxRatio = Math.max(...top.map((p) => p.ratio), 0.01);

  if (top.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-[15px] font-semibold mb-2">Лидеры продаж</h2>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Ни один тур ещё не продавался.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold">Топ туров по проценту продаж</h2>
      <div className="flex flex-col gap-3">
        {top.map((p) => {
          const pct = (p.ratio / maxRatio) * 100;
          return (
            <div key={p.id} className="flex items-center gap-3">
              <span
                className="text-[13px] w-[220px] shrink-0 truncate"
                style={{ color: "var(--text-secondary)" }}
                title={p.name}
              >
                {p.name}
              </span>
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--gridline)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(pct, 2)}%`, background: "var(--series-blue)" }}
                />
              </div>
              <span className="tabular text-[13px] font-medium w-16 text-right shrink-0">
                {(p.ratio * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
