"use client";

import type { Thresholds } from "@/lib/types";

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = "%",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <span className="tabular text-[13px] font-medium">
          {value}
          {suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Controls({
  thresholds,
  onChange,
}: {
  thresholds: Thresholds;
  onChange: (t: Thresholds) => void;
}) {
  return (
    <div className="card p-6 flex flex-col gap-5">
      <h2 className="text-[15px] font-semibold">Настройки анализа</h2>
      <Slider
        label="Порог схожести маршрута для каннибализации"
        value={Math.round(thresholds.similarityMin * 100)}
        onChange={(v) => onChange({ ...thresholds, similarityMin: v / 100 })}
        min={40}
        max={100}
      />
      <Slider
        label="Верхняя граница «слабых» продаж"
        value={Math.round(thresholds.lowMax * 100)}
        onChange={(v) => onChange({ ...thresholds, lowMax: v / 100 })}
        min={1}
        max={Math.round(thresholds.mediumMax * 100) - 1}
      />
      <Slider
        label="Верхняя граница «средних» продаж"
        value={Math.round(thresholds.mediumMax * 100)}
        onChange={(v) => onChange({ ...thresholds, mediumMax: v / 100 })}
        min={Math.round(thresholds.lowMax * 100) + 1}
        max={100}
      />
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Выше границы «средних» — категория «хорошо продавались». 0% проданных мест — отдельная категория «не продавались».
      </p>
    </div>
  );
}
