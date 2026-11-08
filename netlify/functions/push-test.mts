// Called from Settings → "Send test notification". Sends today's summary (or a hello) to the signed-in user's devices.
import { buildDigest, localParts, send, setup, text, type Sub } from "../lib/digest.mts";

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let db;
  try { db = setup(); } catch (e: any) { return json(500, { error: e.message }); }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth?.user) return json(401, { error: "Not signed in" });

  const { data, error } = await db.from("push_subscriptions").select("*").eq("user_id", auth.user.id);
  if (error) return json(500, { error: error.message });
  let sent = 0;
  for (const sub of (data ?? []) as Sub[]) {
    const { date } = localParts(sub.timezone);
    const digest = await buildDigest(db, sub.user_id, date, sub.lang);
    const payload = digest ?? { title: text(sub.lang).testTitle, body: text(sub.lang).test, url: "/settings", tag: "test" };
    if (await send(db, sub, payload)) sent++;
  }
  return json(200, { sent });
};
