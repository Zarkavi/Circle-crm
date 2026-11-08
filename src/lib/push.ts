import { supabase } from "./supabase";
import { getLang } from "./i18n";

// Public half of the VAPID key pair. The private half lives only in Netlify's environment variables.
export const VAPID_PUBLIC_KEY = "BKH8HoJb52LxpfVfmLgloUih9zClOvTOq3Dl8QyE0qXIrg3E6aEDSk6IkZLiJ-biwiH7qU3gcyEUN8A-wwunrqE";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
}

export async function pushState(): Promise<PushState> {
  // iPhone only allows web push for apps added to the home screen
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush(notifyHour: number) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission");
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase!.from("push_subscriptions").upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      lang: getLang(),
      notify_hour: notifyHour,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function disablePush() {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase!.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function currentNotifyHour(): Promise<number | null> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const { data } = await supabase!.from("push_subscriptions").select("notify_hour").eq("endpoint", sub.endpoint).maybeSingle();
  return data?.notify_hour ?? null;
}

/** Keeps the stored language in sync so notifications arrive in the app's language. */
export async function syncPushLang() {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await supabase?.from("push_subscriptions").update({ lang: getLang() }).eq("endpoint", sub.endpoint);
  } catch {}
}

export async function sendTestPush() {
  const { data: { session } } = await supabase!.auth.getSession();
  const res = await fetch("/.netlify/functions/push-test", {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as { sent: number };
}
