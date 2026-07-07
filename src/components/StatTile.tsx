type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warning" | "critical";
};

const TONE_COLOR: Record<NonNullable<Props["tone"]>, string> = {
  default: "var(--text-primary)",
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
};

export function StatTile({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-1 min-w-0">
      <span className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        className="tabular text-[28px] leading-tight font-semibold truncate"
        style={{ color: TONE_COLOR[tone] }}
      >
        {value}
      </span>
      {hint && (
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
