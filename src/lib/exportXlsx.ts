import * as XLSX from "xlsx";
import type { AnalysisResult, CannibalPair, TourProduct, TourVerdict } from "./types";

const STATUS_LABEL: Record<TourVerdict["recommendation"], string> = {
  keep: "Оставить",
  remove_zero: "Снять — нет продаж",
  remove_cannibal: "Снять — каннибализация",
};

function productRow(p: TourProduct, verdictById: Map<string, TourVerdict>) {
  const v = verdictById.get(p.id);
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
    ...(v ? { Решение: STATUS_LABEL[v.recommendation], Причина: v.reason } : {}),
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
  const verdictById = new Map(analysis.verdicts.map((v) => [v.product.id, v]));
  const removeZeroCount = analysis.verdicts.filter((v) => v.recommendation === "remove_zero").length;
  const removeCannibalCount = analysis.verdicts.filter((v) => v.recommendation === "remove_cannibal").length;
  const keepCount = analysis.verdicts.filter((v) => v.recommendation === "keep").length;

  const overallSellThrough = analysis.totals.seats > 0 ? (analysis.totals.sold / analysis.totals.seats) * 100 : 0;
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Показатель", "Значение"],
    ["Всего туров выставлено", analysis.uniqueIds],
    ["Рекомендовано оставить", keepCount],
    ["Рекомендовано снять — нет продаж", removeZeroCount],
    ["Рекомендовано снять — каннибализация", removeCannibalCount],
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

  const productsSheet = XLSX.utils.json_to_sheet(analysis.products.map((p) => productRow(p, verdictById)));
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
    { wch: 20 },
    { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(wb, productsSheet, "Туры");

  const zeroSales = analysis.tiers.none;
  if (zeroSales.length) {
    const zeroSheet = XLSX.utils.json_to_sheet(zeroSales.map((p) => productRow(p, verdictById)));
    XLSX.utils.book_append_sheet(wb, zeroSheet, "0 продаж");
  }

  const lowSales = [...analysis.tiers.low].sort((a, b) => b.seats - b.sold - (a.seats - a.sold));
  if (lowSales.length) {
    const lowSheet = XLSX.utils.json_to_sheet(lowSales.map((p) => productRow(p, verdictById)));
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
