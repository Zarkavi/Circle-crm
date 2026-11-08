// Runs every hour. Each phone gets one summary per day, at the hour picked in Settings (its own time zone).
import { buildDigest, localParts, send, setup, type Sub } from "../lib/digest.mts";

export default async () => {
  const db = setup();
  const { data, error } = await db.from("push_subscriptions").select("*");
  if (error) throw error;
  const now = new Date();
  let sent = 0;
  const cache = new Map<string, Awaited<ReturnType<typeof buildDigest>>>();

  for (const sub of (data ?? []) as Sub[]) {
    const { date, hour } = localParts(sub.timezone, now);
    if (hour !== sub.notify_hour || sub.last_sent_on === date) continue;
    const key = `${sub.user_id}|${date}|${sub.lang}`;
    if (!cache.has(key)) cache.set(key, await buildDigest(db, sub.user_id, date, sub.lang));
    const digest = cache.get(key);
    if (digest && (await send(db, sub, digest))) sent++;
    await db.from("push_subscriptions").update({ last_sent_on: date }).eq("id", sub.id);
  }
  console.log(`send-reminders: ${sent} notification(s) sent`);
  return new Response("ok");
};

export const config = { schedule: "@hourly" };
