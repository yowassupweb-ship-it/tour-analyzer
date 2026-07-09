import * as XLSX from "xlsx";
import type { AnalysisResult, CannibalPair, TourProduct } from "./types";

type Recommendation = { status: "Снять" | "Оставить"; reason: string };

// A tour is a cut candidate if it never sold, or if it's the weaker side of an
// explicit cannibalization conflict where sales actually decide the winner —
// tie cases with no sales basis are left as "keep" (no evidence to cut them).
function buildRecommendations(analysis: AnalysisResult): Map<string, Recommendation> {
  const reco = new Map<string, Recommendation>();
  for (const p of analysis.products) {
    reco.set(p.id, { status: "Оставить", reason: "" });
  }
  for (const p of analysis.tiers.none) {
    reco.set(p.id, { status: "Снять", reason: "0 продаж" });
  }
  for (const pair of analysis.cannibalPairs) {
    const explicit = pair.sharedDates > 0 || pair.nearDates > 0;
    if (!explicit || !pair.salesBasis) continue;
    if (reco.get(pair.victim.id)?.status === "Снять") continue;
    reco.set(pair.victim.id, { status: "Снять", reason: `каннибализация («${pair.survivor.name}»)` });
  }
  return reco;
}

function productRow(p: TourProduct, reco?: Map<string, Recommendation>) {
  const r = reco?.get(p.id);
  return {
    "№ тура": p.id,
    Название: p.name,
    Маршрут: p.route,
    Отправлений: p.departures,
    Мест: p.seats,
    Продано: p.sold,
    "% продаж": Number((p.ratio * 100).toFixed(1)),
    "Первая дата": p.firstDate ?? "",
    "Последняя дата": p.lastDate ?? "",
    ...(r ? { Рекомендация: r.status, Причина: r.reason } : {}),
  };
}

function cannibalRow(pair: CannibalPair) {
  return {
    "Тур 1": pair.a.name,
    "№ тура 1": pair.a.id,
    "Маршрут 1": pair.a.route,
    "Продано 1": pair.a.sold,
    "Тур 2": pair.b.name,
    "№ тура 2": pair.b.id,
    "Маршрут 2": pair.b.route,
    "Продано 2": pair.b.sold,
    "% схожести маршрута": Number((pair.score * 100).toFixed(0)),
    "Общих дат (в один день)": pair.sharedDates,
    "Рядом (±2 дня)": pair.nearDates,
    "Из отправлений": pair.minDepartures,
    "Оставить (больше продаж)": pair.salesBasis ? pair.survivor.name : "",
    "Снять с продажи": pair.salesBasis ? pair.victim.name : "",
    Примечание: pair.salesBasis ? "" : "Нет продаж ни у одного из туров — оснований для выбора нет",
  };
}

export function exportAnalysisToXlsx(analysis: AnalysisResult, fileName = "tour-analysis.xlsx") {
  const wb = XLSX.utils.book_new();
  const reco = buildRecommendations(analysis);
  const cutCount = [...reco.values()].filter((r) => r.status === "Снять").length;
  const keepCount = analysis.products.length - cutCount;

  const overallSellThrough = analysis.totals.seats > 0 ? (analysis.totals.sold / analysis.totals.seats) * 100 : 0;
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Показатель", "Значение"],
    ["Всего туров выставлено", analysis.uniqueIds],
    ["Рекомендовано снять", cutCount],
    ["Рекомендовано оставить", keepCount],
    ["Строк-отправлений", analysis.rawRowCount],
    ["Уникальных пар «имя+маршрут»", analysis.uniqueNameRoutePairs],
    ["Никогда не продавались", analysis.tiers.none.length],
    ["Слабые продажи", analysis.tiers.low.length],
    ["Средние продажи", analysis.tiers.medium.length],
    ["Хорошие продажи", analysis.tiers.good.length],
    ["Всего мест", analysis.totals.seats],
    ["Всего продано", analysis.totals.sold],
    ["Общая заполняемость, %", Number(overallSellThrough.toFixed(1))],
    ["Пар каннибализации", analysis.cannibalPairs.length],
    ["Явных конфликтов (общие даты)", analysis.cannibalPairs.filter((p) => p.sharedDates > 0).length],
    ["Мягких конфликтов (±2 дня)", analysis.cannibalPairs.filter((p) => p.sharedDates === 0 && p.nearDates > 0).length],
  ]);
  summarySheet["!cols"] = [{ wch: 32 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Сводка");

  const productsSheet = XLSX.utils.json_to_sheet(analysis.products.map((p) => productRow(p, reco)));
  productsSheet["!cols"] = [
    { wch: 10 },
    { wch: 36 },
    { wch: 36 },
    { wch: 12 },
    { wch: 8 },
    { wch: 9 },
    { wch: 9 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, productsSheet, "Туры");

  const zeroSales = analysis.tiers.none;
  if (zeroSales.length) {
    const zeroSheet = XLSX.utils.json_to_sheet(zeroSales.map((p) => productRow(p, reco)));
    XLSX.utils.book_append_sheet(wb, zeroSheet, "0 продаж");
  }

  const lowSales = [...analysis.tiers.low].sort((a, b) => b.seats - b.sold - (a.seats - a.sold));
  if (lowSales.length) {
    const lowSheet = XLSX.utils.json_to_sheet(lowSales.map((p) => productRow(p, reco)));
    XLSX.utils.book_append_sheet(wb, lowSheet, "Слабые продажи");
  }

  if (analysis.cannibalPairs.length) {
    const cannibalSheet = XLSX.utils.json_to_sheet(analysis.cannibalPairs.map(cannibalRow));
    cannibalSheet["!cols"] = [
      { wch: 30 },
      { wch: 10 },
      { wch: 30 },
      { wch: 10 },
      { wch: 30 },
      { wch: 10 },
      { wch: 30 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 30 },
      { wch: 30 },
      { wch: 42 },
    ];
    XLSX.utils.book_append_sheet(wb, cannibalSheet, "Каннибализация");
  }

  if (analysis.inconsistentIds.length) {
    const inconsistentSheet = XLSX.utils.json_to_sheet(
      analysis.inconsistentIds.map((i) => ({
        "№ тура": i.id,
        Названия: i.names.join(" / "),
        Маршруты: i.routes.join(" / "),
      }))
    );
    XLSX.utils.book_append_sheet(wb, inconsistentSheet, "Несоответствия ID");
  }

  XLSX.writeFile(wb, fileName);
}
