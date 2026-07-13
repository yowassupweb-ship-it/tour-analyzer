import type { ReportV2 } from "@/lib/analyzeV2";
import { parseRichText } from "@/lib/richText";

const CRITICAL_DATES_LIMIT = 10;

export function InsightsV2({ report }: { report: ReportV2 }) {
  const topCriticalDates = report.criticalDates.slice(0, CRITICAL_DATES_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6 flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold">Блок 2. Аналитическое заключение для топ-менеджмента</h2>

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            1. Критические даты
          </h3>
          {report.criticalDates.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Дат с избыточным количеством туров-дублей не найдено.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {topCriticalDates.map((d) => (
                <li
                  key={d.date}
                  className="text-[13px] rounded-[var(--radius-sm)] px-3 py-2"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)", color: "var(--text-secondary)" }}
                >
                  {parseRichText(
                    `**${d.date}** — на эту дату выставлено {{r:${d.duplicateCount} туров-дублей}} с нулевыми или минимальными продажами (FORCE_DELETE / OPTIMIZE_CANNIBAL). Пересмотреть план отправлений.`
                  )}
                </li>
              ))}
            </ul>
          )}
          {report.criticalDates.length > CRITICAL_DATES_LIMIT && (
            <p className="text-[12px] text-center mt-1" style={{ color: "var(--text-muted)" }}>
              Показаны {CRITICAL_DATES_LIMIT} самых проблемных из {report.criticalDates.length} дат
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            2. Фокус внимания — приоритет на ручной SEO
          </h3>
          {report.focusAttention.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Туров с решением MANUAL_SEO не найдено.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {report.focusAttention.map((v, i) => (
                <li
                  key={`${v.row.tourId}-${v.row.departureDate}-${i}`}
                  className="text-[13px] rounded-[var(--radius-sm)] px-3 py-2"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border-hairline)", color: "var(--text-secondary)" }}
                >
                  {parseRichText(
                    `ID **${v.row.tourId}** — «${v.row.routeName}» (${v.row.departureDate}): Final Score {{g:${(v.finalScore * 100).toFixed(
                      1
                    )}%}}, LF {{g:${(v.lf * 100).toFixed(1)}%}}${
                      v.isEvent ? ", событийный тур" : ""
                    }. Максимальный коммерческий потенциал — приоритет на ручное прописание Title/Description/H1.`
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
