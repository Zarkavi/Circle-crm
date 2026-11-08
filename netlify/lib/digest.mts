// Shared by the scheduled reminder job and the test endpoint.
import * as webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const VAPID_PUBLIC_KEY = "BKH8HoJb52LxpfVfmLgloUih9zClOvTOq3Dl8QyE0qXIrg3E6aEDSk6IkZLiJ-biwiH7qU3gcyEUN8A-wwunrqE";

export interface Sub {
  id: string; user_id: string; endpoint: string; p256dh: string; auth: string;
  timezone: string; lang: string; notify_hour: number; last_sent_on: string | null;
}

/** Reads settings from Netlify environment variables; throws a readable error if one is missing. */
export function setup(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapid = process.env.VAPID_PRIVATE_KEY;
  const missing = [!url && "VITE_SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY", !vapid && "VAPID_PRIVATE_KEY"].filter(Boolean);
  if (missing.length) throw new Error(`Missing Netlify environment variables: ${missing.join(", ")}`);
  webpush.setVapidDetails(process.env.URL || "https://circlecrmapp.netlify.app", VAPID_PUBLIC_KEY, vapid!);
  return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Date ('YYYY-MM-DD') and hour (0-23) in the subscriber's own time zone. */
export function localParts(tz: string, now = new Date()) {
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  } catch {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  }
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const TEXT = {
  en: {
    title: "Today in Circle", birthdays: "🎂 Birthday today", tomorrow: "🎂 Tomorrow", reminders: "🔔 Reminders",
    overdue: "overdue", more: "more", test: "Notifications are working ✅", testTitle: "Circle",
  },
  tr: {
    title: "Bugün Circle'da", birthdays: "🎂 Bugün doğum günü", tomorrow: "🎂 Yarın doğum günü", reminders: "🔔 Hatırlatıcılar",
    overdue: "gecikmiş", more: "tane daha", test: "Bildirimler çalışıyor ✅", testTitle: "Circle",
  },
};
export const text = (lang: string) => (lang === "tr" ? TEXT.tr : TEXT.en);

const list = (items: string[], lang: string, max = 3) =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} +${items.length - max} ${text(lang).more}`;

/** Builds the daily summary for one user, or null when there's nothing to say. */
export async function buildDigest(db: SupabaseClient, userId: string, localDate: string, lang: string) {
  const [people, rels, rems] = await Promise.all([
    db.from("people").select("id, full_name, nickname, birthday").eq("user_id", userId),
    db.from("relationships").select("person_id, name, birthday, related_person_id").eq("user_id", userId).not("birthday", "is", null),
    db.from("reminders").select("title, due_date").eq("user_id", userId).eq("done", false).lte("due_date", localDate).order("due_date"),
  ]);
  for (const r of [people, rels, rems]) if (r.error) throw r.error;
  return composeDigest(people.data ?? [], rels.data ?? [], rems.data ?? [], localDate, lang);
}

export function composeDigest(
  people: { id: string; full_name: string; nickname?: string | null; birthday?: string | null }[],
  rels: { person_id: string; name?: string | null; birthday?: string | null; related_person_id?: string | null }[],
  rems: { title: string; due_date: string }[],
  localDate: string,
  lang: string,
) {
  const T = text(lang);
  const md = (iso: string) => iso.slice(5);
  const today = md(localDate), tomorrow = md(addDays(localDate, 1));
  const byId = new Map(people.map((p) => [p.id, p]));
  const first = (p: { full_name: string; nickname?: string | null }) => p.nickname || p.full_name.split(" ")[0];

  const bdays = (day: string) => [
    ...people.filter((p) => p.birthday?.slice(-5) === day).map((p) => p.full_name),
    ...rels
      .filter((r) => !r.related_person_id && r.name && r.birthday?.slice(-5) === day)
      .map((r) => { const o = byId.get(r.person_id); return o ? `${r.name} (${first(o)})` : r.name!; }),
  ];
  const lines: string[] = [];
  const bToday = bdays(today), bTomorrow = bdays(tomorrow);
  if (bToday.length) lines.push(`${T.birthdays}: ${list(bToday, lang)}`);
  if (bTomorrow.length) lines.push(`${T.tomorrow}: ${list(bTomorrow, lang)}`);
  if (rems.length) {
    const overdue = rems.filter((r) => r.due_date < localDate).length;
    lines.push(`${T.reminders}${overdue ? ` (${overdue} ${T.overdue})` : ""}: ${list(rems.map((r) => r.title), lang, 2)}`);
  }
  if (!lines.length) return null;
  return { title: T.title, body: lines.join("\n"), url: bToday.length || bTomorrow.length ? "/" : "/reminders", tag: `digest-${localDate}` };
}

/** Sends one notification; removes subscriptions the browser has thrown away. */
export async function send(db: SupabaseClient, sub: Sub, payload: object) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
    return true;
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subscriptions").delete().eq("id", sub.id);
    else console.error("push failed", sub.endpoint.slice(0, 40), e?.statusCode, e?.body ?? e?.message);
    return false;
  }
}
