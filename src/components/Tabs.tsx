"use client";

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div
      className="inline-flex p-1 rounded-[var(--radius-md)] gap-1 self-start"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="text-[13px] font-medium px-3.5 py-1.5 rounded-[10px] transition-colors"
            style={{
              background: isActive ? "var(--surface-1)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
