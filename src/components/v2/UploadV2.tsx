"use client";

import { useRef, useState } from "react";
import type { ParsedSheetV2 } from "@/lib/parseWorkbookV2";
import { parseWorkbookBufferV2 } from "@/lib/parseWorkbookV2";

export function UploadV2({
  parsedSheets,
  selectedSheets,
  onToggleSheet,
  onParsed,
  onLoadDemo,
  usingDemo,
}: {
  parsedSheets: ParsedSheetV2[];
  selectedSheets: Set<string>;
  onToggleSheet: (name: string) => void;
  onParsed: (sheets: ParsedSheetV2[], fileName: string) => void;
  onLoadDemo: () => void;
  usingDemo: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const sheets = parseWorkbookBufferV2(buffer);
      const withRows = sheets.filter((s) => s.rows.length > 0);
      if (withRows.length === 0) {
        setError(
          "В файле не найдено ни одной строки. Проверьте столбцы: название маршрута / маршрут / продолжительность / ID тура / дата выезда / мест в продаже / продано."
        );
        return;
      }
      setFileName(file.name);
      onParsed(withRows, file.name);
    } catch {
      setError("Не удалось прочитать файл. Ожидается .xlsx.");
    }
  }

  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-[15px] font-semibold">Данные</h2>
        <button
          onClick={onLoadDemo}
          className="text-[13px] font-medium px-3 py-1.5 rounded-lg"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)" }}
        >
          Загрузить демо-данные
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className="rounded-[var(--radius-md)] p-8 flex flex-col items-center justify-center gap-2 cursor-pointer text-center transition-colors"
        style={{
          border: `1.5px dashed ${dragOver ? "var(--series-blue)" : "var(--border-hairline)"}`,
          background: dragOver ? "color-mix(in srgb, var(--series-blue) 6%, transparent)" : "var(--surface-2)",
        }}
      >
        <span className="text-[14px] font-medium">Перетащите .xlsx сюда или нажмите, чтобы выбрать файл</span>
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Столбцы: название маршрута / маршрут / продолжительность / ID тура / дата выезда / мест в продаже / продано
          — порядок и написание могут отличаться. Нет столбца «продолжительность»? Возьмём число из конца названия.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="text-[13px]" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}

      {parsedSheets.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {usingDemo ? "Демо-набор" : fileName ?? "Файл"} — выберите листы для анализа:
          </span>
          <div className="flex flex-col gap-1.5">
            {parsedSheets.map((sheet) => (
              <label key={sheet.sheetName} className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSheets.has(sheet.sheetName)}
                  onChange={() => onToggleSheet(sheet.sheetName)}
                />
                <span className="font-medium">{sheet.sheetName}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  — {sheet.rows.length} строк
                  {sheet.skippedRows > 0 ? `, пропущено ${sheet.skippedRows}` : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
