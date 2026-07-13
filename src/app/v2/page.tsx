"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import demoTours from "@/data/demo-tours.json";
import { analyzeV2 } from "@/lib/analyzeV2";
import type { RawRowV2 } from "@/lib/analyzeV2";
import type { ParsedSheetV2 } from "@/lib/parseWorkbookV2";
import { UploadV2 } from "@/components/v2/UploadV2";
import { ReportTableV2 } from "@/components/v2/ReportTableV2";
import { InsightsV2 } from "@/components/v2/InsightsV2";
import { StatTile } from "@/components/StatTile";

const DEMO_SHEET_NAME = "Демо: Продажи";

type DemoRow = {
  name: string;
  route: string;
  tourNo: number | string;
  date: string | null;
  seats: number | null;
  sold: number | null;
};

function trailingDuration(name: string): number {
  const match = name.match(/\s*-\s*(\d+)\s*$/);
  return match ? Number(match[1]) : 1;
}

function buildDemoSheet(): ParsedSheetV2 {
  const rows: RawRowV2[] = (demoTours as DemoRow[])
    .filter((r) => r.date !== null)
    .map((r) => ({
      routeName: r.name,
      route: r.route,
      durationDays: trailingDuration(r.name),
      tourId: String(r.tourNo),
      departureDate: r.date as string,
      seats: r.seats ?? 0,
      sold: r.sold ?? 0,
    }));
  return { sheetName: DEMO_SHEET_NAME, rows, skippedRows: 0 };
}

function EmptyState() {
  return (
    <div className="card p-10 flex flex-col items-center gap-2 text-center">
      <span className="text-[15px] font-medium">Пока нет данных</span>
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Загрузите таблицу выше, чтобы увидеть расчёт.
      </span>
    </div>
  );
}

export default function HomeV2() {
  const [parsedSheets, setParsedSheets] = useState<ParsedSheetV2[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [usingDemo, setUsingDemo] = useState(false);

  const rows = useMemo(
    () => parsedSheets.filter((s) => selectedSheets.has(s.sheetName)).flatMap((s) => s.rows),
    [parsedSheets, selectedSheets]
  );

  const report = useMemo(() => analyzeV2(rows), [rows]);
  const hasData = rows.length > 0;

  function handleParsed(sheets: ParsedSheetV2[]) {
    setParsedSheets(sheets);
    setSelectedSheets(new Set(sheets.map((s) => s.sheetName)));
    setUsingDemo(false);
  }

  function handleLoadDemo() {
    const demo = buildDemoSheet();
    setParsedSheets([demo]);
    setSelectedSheets(new Set([DEMO_SHEET_NAME]));
    setUsingDemo(true);
  }

  function toggleSheet(name: string) {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const counts = report.rows.reduce(
    (acc, v) => {
      acc[v.decision] = (acc[v.decision] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex-1" style={{ background: "var(--surface-0)" }}>
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-[26px] font-semibold tracking-tight">Анализ продаж туров — v2</h1>
            <Link href="/" className="text-[13px] font-medium" style={{ color: "var(--series-blue)" }}>
              ← Analyzer v1
            </Link>
          </div>
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Load Factor, событийность, сезон, индекс схожести маршрутов (Jaccard) и штраф за каннибализацию —
            отдельная модель расчёта с матрицей решений и SEO-директивами для CMS.
          </p>
        </header>

        <UploadV2
          parsedSheets={parsedSheets}
          selectedSheets={selectedSheets}
          onToggleSheet={toggleSheet}
          onParsed={handleParsed}
          onLoadDemo={handleLoadDemo}
          usingDemo={usingDemo}
        />

        {hasData && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatTile label="Всего туров" value={String(report.rows.length)} />
            <StatTile label="FORCE_DELETE" value={String(counts.FORCE_DELETE ?? 0)} tone="critical" />
            <StatTile label="OPTIMIZE_CANNIBAL" value={String(counts.OPTIMIZE_CANNIBAL ?? 0)} tone="warning" />
            <StatTile label="KEEP_LEADER / EVENT" value={String((counts.KEEP_LEADER ?? 0) + (counts.KEEP_EVENT ?? 0))} tone="good" />
            <StatTile label="REVISE" value={String(counts.REVISE ?? 0)} />
          </div>
        )}

        {hasData ? (
          <>
            <ReportTableV2 verdicts={report.rows} />
            <InsightsV2 report={report} />
          </>
        ) : (
          <EmptyState />
        )}

        <footer className="text-[12px] py-6 text-center" style={{ color: "var(--text-muted)" }}>
          Все вычисления выполняются в браузере — данные файла никуда не отправляются.
        </footer>
      </div>
    </div>
  );
}
