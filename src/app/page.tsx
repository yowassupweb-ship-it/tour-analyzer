"use client";

import { useMemo, useState } from "react";
import demoTours from "@/data/demo-tours.json";
import { analyze, DEFAULT_THRESHOLDS } from "@/lib/analyze";
import type { ParsedSheet } from "@/lib/parseWorkbook";
import type { RawRow, Thresholds } from "@/lib/types";
import { Dropzone } from "@/components/Dropzone";
import { Controls } from "@/components/Controls";
import { StatTile } from "@/components/StatTile";
import { TierChart } from "@/components/TierChart";
import { SellersChart } from "@/components/SellersChart";
import { ProductsTable } from "@/components/ProductsTable";
import { CannibalPanel } from "@/components/CannibalPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { Tabs } from "@/components/Tabs";

const DEMO_SHEET_NAME = "Демо: Продажи";

type DemoRow = {
  name: string;
  route: string;
  tourNo: number | string;
  date: string | null;
  seats: number | null;
  sold: number | null;
};

function buildDemoSheet(): ParsedSheet {
  const rows: RawRow[] = (demoTours as DemoRow[]).map((r) => ({
    name: r.name,
    route: r.route,
    tourNo: String(r.tourNo),
    date: r.date,
    seats: r.seats ?? 0,
    sold: r.sold ?? 0,
    sourceSheet: DEMO_SHEET_NAME,
  }));
  return { sheetName: DEMO_SHEET_NAME, rows, skippedRows: 0 };
}

type TabKey = "result" | "report" | "cannibal" | "settings";

function EmptyState() {
  return (
    <div className="card p-10 flex flex-col items-center gap-2 text-center">
      <span className="text-[15px] font-medium">Пока нет данных</span>
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Загрузите таблицу на вкладке «Настройки», чтобы увидеть отчёт.
      </span>
    </div>
  );
}

export default function Home() {
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [usingDemo, setUsingDemo] = useState(false);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [tab, setTab] = useState<TabKey>("settings");

  const rows = useMemo(
    () => parsedSheets.filter((s) => selectedSheets.has(s.sheetName)).flatMap((s) => s.rows),
    [parsedSheets, selectedSheets]
  );

  const analysis = useMemo(() => analyze(rows, thresholds), [rows, thresholds]);
  const hasData = rows.length > 0;

  function handleParsed(sheets: ParsedSheet[]) {
    setParsedSheets(sheets);
    setSelectedSheets(new Set(sheets.map((s) => s.sheetName)));
    setUsingDemo(false);
    setTab("result");
  }

  function handleLoadDemo() {
    const demo = buildDemoSheet();
    setParsedSheets([demo]);
    setSelectedSheets(new Set([DEMO_SHEET_NAME]));
    setUsingDemo(true);
    setTab("result");
  }

  function toggleSheet(name: string) {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const neverSoldPct = analysis.uniqueIds > 0 ? (analysis.tiers.none.length / analysis.uniqueIds) * 100 : 0;
  const overallSellThrough = analysis.totals.seats > 0 ? (analysis.totals.sold / analysis.totals.seats) * 100 : 0;

  return (
    <div className="flex-1" style={{ background: "var(--surface-0)" }}>
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-tight">Анализ продаж туров</h1>
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Загрузите таблицу (имя / маршрут / № тура / дата / мест в продажу / продано) — приложение нормализует
            данные, сгруппирует по номеру тура и найдёт похожие туры и уровень продаж.
          </p>
        </header>

        <Tabs
          tabs={[
            { key: "result", label: "Результат" },
            { key: "report", label: "Отчёт" },
            { key: "cannibal", label: `Каннибализация${hasData ? ` (${analysis.cannibalPairs.length})` : ""}` },
            { key: "settings", label: "Настройки" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "settings" && (
          <>
            <Dropzone
              parsedSheets={parsedSheets}
              selectedSheets={selectedSheets}
              onToggleSheet={toggleSheet}
              onParsed={handleParsed}
              onLoadDemo={handleLoadDemo}
              usingDemo={usingDemo}
            />

            {analysis.inconsistentIds.length > 0 && (
              <div
                className="rounded-[var(--radius-md)] p-4 text-[13px]"
                style={{
                  background: "color-mix(in srgb, var(--status-warning) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--status-warning) 40%, transparent)",
                  color: "var(--text-primary)",
                }}
              >
                У {analysis.inconsistentIds.length} № тура встречаются разные названия/маршруты в разных строках —
                проверьте эти ID: {analysis.inconsistentIds.slice(0, 8).map((i) => i.id).join(", ")}
                {analysis.inconsistentIds.length > 8 ? "…" : ""}
              </div>
            )}

            {hasData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatTile label="Уникальных туров (по ID)" value={String(analysis.uniqueIds)} hint={`${rows.length} строк-отправлений`} />
                <StatTile
                  label="Уникальных пар «имя+маршрут»"
                  value={String(analysis.uniqueNameRoutePairs)}
                  hint={analysis.uniqueNameRoutePairs !== analysis.uniqueIds ? "имя/маршрут не всегда уникальны" : "совпадает с числом ID"}
                />
                <StatTile
                  label="Никогда не продавались"
                  value={`${neverSoldPct.toFixed(0)}%`}
                  hint={`${analysis.tiers.none.length} из ${analysis.uniqueIds} туров`}
                  tone="critical"
                />
                <StatTile
                  label="Общая заполняемость"
                  value={`${overallSellThrough.toFixed(1)}%`}
                  hint={`${analysis.totals.sold} из ${analysis.totals.seats} мест`}
                  tone="good"
                />
              </div>
            )}

            <Controls thresholds={thresholds} onChange={setThresholds} />
          </>
        )}

        {tab === "result" &&
          (hasData ? <ResultPanel products={analysis.products} cannibalPairs={analysis.cannibalPairs} /> : <EmptyState />)}

        {tab === "report" && (hasData ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TierChart tiers={analysis.tiers} />
              <SellersChart products={analysis.products} />
            </div>
            <ProductsTable products={analysis.products} lowMax={thresholds.lowMax} mediumMax={thresholds.mediumMax} />
          </>
        ) : (
          <EmptyState />
        ))}

        {tab === "cannibal" && (hasData ? <CannibalPanel pairs={analysis.cannibalPairs} /> : <EmptyState />)}

        <footer className="text-[12px] py-6 text-center" style={{ color: "var(--text-muted)" }}>
          Все вычисления выполняются в браузере — данные файла никуда не отправляются.
        </footer>
      </div>
    </div>
  );
}
