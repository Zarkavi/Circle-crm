import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO, addMonths, addYears } from "date-fns";
import { dateLocale, getLang, t } from "./i18n";

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

const PATTERNS = {
  en: { full: "EEEE, MMMM d", dayShort: "EEE, MMM d", date: "MMM d, yyyy", monthDay: "MMM d" },
  tr: { full: "d MMMM EEEE", dayShort: "d MMM EEE", date: "d MMM yyyy", monthDay: "d MMM" },
};
export type DateStyle = keyof typeof PATTERNS.en;

export function fmt(d: Date | string, style: DateStyle = "date") {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, PATTERNS[getLang()][style], { locale: dateLocale() });
}

/** Birthday strings are 'YYYY-MM-DD' or '--MM-DD' (year unknown). */
export function parseBirthday(b?: string | null): { year?: number; month: number; day: number } | null {
  if (!b) return null;
  // also accepts the older "---MM-DD" spelling
  const m = /^(?:(\d{4})-|---?)(\d{2})-(\d{2})$/.exec(b);
  if (!m) return null;
  return { year: m[1] ? Number(m[1]) : undefined, month: Number(m[2]), day: Number(m[3]) };
}

export function nextBirthday(b?: string | null) {
  const p = parseBirthday(b);
  if (!p) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let next = new Date(now.getFullYear(), p.month - 1, p.day);
  if (next < now) next = new Date(now.getFullYear() + 1, p.month - 1, p.day);
  const inDays = differenceInCalendarDays(next, now);
  const turning = p.year ? next.getFullYear() - p.year : undefined;
  return { date: next, inDays, turning };
}

export function ageFrom(b?: string | null) {
  const p = parseBirthday(b);
  if (!p?.year) return undefined;
  const now = new Date();
  let age = now.getFullYear() - p.year;
  if (now.getMonth() + 1 < p.month || (now.getMonth() + 1 === p.month && now.getDate() < p.day)) age--;
  return age;
}

export function formatBirthday(b?: string | null) {
  const p = parseBirthday(b);
  if (!p) return "";
  const md = fmt(new Date(2000, p.month - 1, p.day), "monthDay");
  return p.year ? (getLang() === "tr" ? `${md} ${p.year}` : `${md}, ${p.year}`) : md;
}

export function relativeDays(n: number) {
  if (n === 0) return t("today");
  if (n === 1) return t("tomorrow");
  if (n === -1) return t("yesterday");
  if (n < 0) return t("{n} days ago", { n: -n });
  return t("in {n} days", { n });
}

export function daysSince(iso: string) {
  return differenceInCalendarDays(new Date(), parseISO(iso));
}

export function daysUntil(iso: string) {
  return differenceInCalendarDays(parseISO(iso), new Date());
}

export function ago(iso: string) {
  const d = daysSince(iso);
  if (d <= 1 && d >= -1) return relativeDays(-d);
  if (d < 0) return relativeDays(-d);
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true, locale: dateLocale() });
}

export function advance(iso: string, repeat: "monthly" | "yearly") {
  const d = parseISO(iso);
  return format(repeat === "monthly" ? addMonths(d, 1) : addYears(d, 1), "yyyy-MM-dd");
}
