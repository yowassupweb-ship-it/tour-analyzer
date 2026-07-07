import type { PerformanceTier, TourProduct } from "@/lib/types";

const TIER_META: { key: PerformanceTier; label: string; color: string }[] = [
  { key: "good", label: "Хорошо продавались", color: "var(--status-good)" },
  { key: "medium", label: "Средне", color: "var(--status-warning)" },
  { key: "low", label: "Слабо", color: "var(--status-serious)" },
  { key: "none", label: "Не продавались вообще", color: "var(--status-critical)" },
];

export function TierChart({ tiers }: { tiers: Record<PerformanceTier, TourProduct[]> }) {
  const total = TIER_META.reduce((sum, t) => sum + tiers[t.key].length, 0) || 1;

  return (
    <div className="card p-6 flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold">Эффективность продаж по турам</h2>
      <div className="flex flex-col gap-3">
        {TIER_META.map(({ key, label, color }) => {
          const count = tiers[key].length;
          const pct = (count / total) * 100;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[13px] w-[168px] shrink-0" style={{ color: "var(--text-secondary)" }}>
                {label}
              </span>
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--gridline)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%`, background: color }}
                  title={`${count} туров (${pct.toFixed(0)}%)`}
                />
              </div>
              <span className="tabular text-[13px] font-medium w-14 text-right shrink-0" style={{ color: "var(--text-primary)" }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
