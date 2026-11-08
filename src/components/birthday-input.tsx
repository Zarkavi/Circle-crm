import { Select, Input } from "@/components/ui/input";
import { parseBirthday } from "@/lib/dates";
import { dateLocale, t } from "@/lib/i18n";
import { format } from "date-fns";


/** Month + day + optional year, stored as 'YYYY-MM-DD' or '--MM-DD'. */
export function BirthdayInput({ value, onChange }: { value?: string | null; onChange(v: string | null): void }) {
  const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "MMM", { locale: dateLocale() }));
  const p = parseBirthday(value);
  const month = p?.month ?? 0, day = p?.day ?? 0, year = p?.year;
  const emit = (m: number, d: number, y?: number) => {
    if (!m || !d) return onChange(null);
    const md = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onChange(y ? `${String(y).padStart(4, "0")}-${md}` : `--${md}`);
  };
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1.2fr] gap-2">
      <Select value={month} onChange={(e) => emit(Number(e.target.value), day || 1, year)} aria-label={t("Month")}>
        <option value={0}>{t("Month")}</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </Select>
      <Select value={day} onChange={(e) => emit(month || 1, Number(e.target.value), year)} aria-label={t("Day")}>
        <option value={0}>{t("Day")}</option>
        {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </Select>
      <Input inputMode="numeric" placeholder={t("Year (opt.)")} value={year ?? ""} aria-label={t("Year")} maxLength={4}
        onChange={(e) => {
          const y = e.target.value.replace(/\D/g, "");
          emit(month, day, y.length === 4 ? Number(y) : undefined);
        }} />
    </div>
  );
}
