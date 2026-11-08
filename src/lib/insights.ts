import type { Interaction, Job, Person, Relationship, TableName, Tables } from "./types";
import { daysSince, nextBirthday } from "./dates";
import { getLang, t } from "./i18n";

type Db = { [K in TableName]: Tables[K][] };

export const RELATIONS: { value: string; label: string; inverse: string }[] = [
  { value: "child", label: "Child", inverse: "parent" },
  { value: "spouse", label: "Spouse", inverse: "spouse" },
  { value: "partner", label: "Partner", inverse: "partner" },
  { value: "parent", label: "Parent", inverse: "child" },
  { value: "sibling", label: "Sibling", inverse: "sibling" },
  { value: "relative", label: "Relative", inverse: "relative" },
  { value: "friend", label: "Friend", inverse: "friend" },
  { value: "colleague", label: "Colleague", inverse: "colleague" },
  { value: "manager", label: "Manager", inverse: "report" },
  { value: "report", label: "Reports to them", inverse: "manager" },
  { value: "introduced_by", label: "Introduced by", inverse: "introduced" },
  { value: "introduced", label: "Introduced me to", inverse: "introduced_by" },
  { value: "pet", label: "Pet", inverse: "owner" },
  { value: "other", label: "Other", inverse: "other" },
];
export const relationLabel = (v: string) =>
  t(v === "owner" ? "Owner" : RELATIONS.find((r) => r.value === v)?.label ?? v);

// Turkish possessive forms: "Anna'nın çocuğu"
const TR_POSSESSIVE: Record<string, string> = {
  child: "çocuğu", spouse: "eşi", partner: "partneri", parent: "ebeveyni", sibling: "kardeşi", relative: "akrabası",
  friend: "arkadaşı", colleague: "iş arkadaşı", manager: "yöneticisi", report: "çalışanı", pet: "evcil hayvanı", other: "yakını",
};
function trGenitive(name: string) {
  const vowels = name.toLowerCase().match(/[aeıioöuü]/g);
  const last = vowels?.at(-1) ?? "e";
  const v = "aı".includes(last) ? "ı" : "ei".includes(last) ? "i" : "ou".includes(last) ? "u" : "ü";
  const endsWithVowel = /[aeıioöuü]$/i.test(name);
  return `${name}'${endsWithVowel ? "n" : ""}${v}n`;
}
/** "Anna's child" / "Anna'nın çocuğu" */
export function ownerRelation(owner: string, relation: string) {
  if (getLang() === "tr") return `${trGenitive(owner)} ${TR_POSSESSIVE[relation] ?? relationLabel(relation).toLowerCase()}`;
  return `${owner}'s ${relationLabel(relation).toLowerCase()}`;
}
export const inverseRelation = (v: string) => RELATIONS.find((r) => r.value === v)?.inverse ?? v;

export const FACT_CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "food", label: "Food", emoji: "🍽️" },
  { value: "drinks", label: "Drinks", emoji: "☕" },
  { value: "hobbies", label: "Hobbies", emoji: "🎯" },
  { value: "music", label: "Music & media", emoji: "🎧" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "travel", label: "Travel", emoji: "✈️" },
  { value: "gifts", label: "Gift ideas", emoji: "🎁" },
  { value: "dislikes", label: "Dislikes", emoji: "🚫" },
  { value: "health", label: "Health", emoji: "🩺" },
  { value: "goals", label: "Goals", emoji: "🚀" },
  { value: "other", label: "Other", emoji: "📝" },
];
export const factMeta = (v: string) => {
  const c = FACT_CATEGORIES.find((c) => c.value === v) ?? FACT_CATEGORIES.at(-1)!;
  return { ...c, label: t(c.label) };
};

export const INTERACTION_KINDS: { value: string; label: string; emoji: string }[] = [
  { value: "meeting", label: "Meeting", emoji: "🤝" },
  { value: "coffee", label: "Coffee", emoji: "☕" },
  { value: "meal", label: "Meal", emoji: "🍽️" },
  { value: "call", label: "Call", emoji: "📞" },
  { value: "message", label: "Message", emoji: "💬" },
  { value: "event", label: "Event", emoji: "🎉" },
  { value: "other", label: "Other", emoji: "📝" },
];
export const kindMeta = (v: string) => {
  const k = INTERACTION_KINDS.find((c) => c.value === v) ?? INTERACTION_KINDS.at(-1)!;
  return { ...k, label: t(k.label) };
};

export const TAG_COLORS = ["violet", "sky", "emerald", "amber", "rose", "slate"] as const;

export function currentJob(jobs: Job[], personId: string) {
  const mine = jobs.filter((j) => j.person_id === personId);
  return mine.find((j) => j.is_current) ?? mine.find((j) => !j.end_date) ?? null;
}

export function lastInteraction(interactions: Interaction[], personId: string) {
  let best: Interaction | null = null;
  for (const i of interactions) if (i.person_id === personId && (!best || i.date > best.date)) best = i;
  return best;
}

/** Relationships shown on a person's page: their own plus inverse links pointing at them. */
export function relationsFor(db: Db, personId: string) {
  const own = db.relationships.filter((r) => r.person_id === personId);
  const incoming = db.relationships
    .filter((r) => r.related_person_id === personId && r.person_id !== personId)
    .map<Relationship & { incoming: true }>((r) => ({
      ...r, incoming: true, relation: inverseRelation(r.relation), related_person_id: r.person_id, person_id: personId,
    }));
  return [...own.map((r) => ({ ...r, incoming: false as const })), ...incoming];
}

export interface UpcomingBirthday {
  key: string;
  name: string;
  personId: string;          // whose page to open
  via?: string;              // "Anna's child"
  inDays: number;
  turning?: number;
  date: Date;
}

export function upcomingBirthdays(db: Db, withinDays = 30): UpcomingBirthday[] {
  const out: UpcomingBirthday[] = [];
  for (const p of db.people) {
    const n = nextBirthday(p.birthday);
    if (n && n.inDays <= withinDays) out.push({ key: p.id, name: p.full_name, personId: p.id, ...n });
  }
  for (const r of db.relationships) {
    if (r.related_person_id || !r.name) continue;
    const n = nextBirthday(r.birthday);
    const owner = db.people.find((p) => p.id === r.person_id);
    if (n && owner && n.inDays <= withinDays)
      out.push({ key: r.id, name: r.name, personId: owner.id, via: ownerRelation(firstName(owner), r.relation), ...n });
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

export function keepInTouchDue(db: Db) {
  const out: { person: Person; daysSince: number | null; overdueBy: number }[] = [];
  for (const p of db.people) {
    if (!p.keep_in_touch_days) continue;
    const last = lastInteraction(db.interactions, p.id);
    const since = last ? daysSince(last.date) : null;
    const overdueBy = since === null ? p.keep_in_touch_days : since - p.keep_in_touch_days;
    if (since === null || overdueBy >= 0) out.push({ person: p, daysSince: since, overdueBy });
  }
  return out.sort((a, b) => b.overdueBy - a.overdueBy);
}

/** "Product Lead at Stripe" / "Stripe · Product Lead" */
export function jobLabel(job: { title?: string | null; company: string }) {
  if (!job.title) return job.company;
  return getLang() === "tr" ? `${job.company} · ${job.title}` : `${job.title} at ${job.company}`;
}

export const firstName = (p: Person) => p.nickname || p.full_name.split(" ")[0];

export interface SearchHit {
  person: Person;
  where: string;      // "Small detail", "Meeting"...
  snippet: string;
  score: number;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function snippetAround(text: string, q: string) {
  const i = norm(text).indexOf(q);
  if (i < 0 || text.length <= 90) return text;
  const start = Math.max(0, i - 35);
  return (start > 0 ? "…" : "") + text.slice(start, start + 90).trim() + (start + 90 < text.length ? "…" : "");
}

/** Searches every field of every record and groups the hits by person. */
export function searchAll(db: Db, query: string): SearchHit[] {
  const q = norm(query.trim());
  if (!q) return [];
  const hits = new Map<string, SearchHit>();
  const add = (personId: string, where: string, text: string | null | undefined, score: number) => {
    if (!text || !norm(text).includes(q)) return;
    const person = db.people.find((p) => p.id === personId);
    if (!person) return;
    const prev = hits.get(personId);
    if (!prev || prev.score < score) hits.set(personId, { person, where, snippet: snippetAround(text, q), score });
  };
  const tagName = new Map(db.tags.map((t) => [t.id, t.name]));

  for (const p of db.people) {
    add(p.id, t("Name"), p.full_name, 100);
    add(p.id, t("Nickname"), p.nickname, 90);
    add(p.id, t("City"), p.city, 40);
    add(p.id, t("Email"), p.email, 50);
    add(p.id, t("Phone"), p.phone, 50);
    add(p.id, t("How we met"), p.how_we_met, 30);
    add(p.id, t("Notes"), p.notes, 20);
  }
  for (const j of db.jobs) {
    add(j.person_id, j.is_current ? t("Works at") : t("Worked at"), `${j.company}${j.title ? " · " + j.title : ""}`, 60);
    add(j.person_id, t("Work notes"), j.notes, 20);
  }
  for (const r of db.relationships) {
    if (r.name) add(r.person_id, relationLabel(r.relation), `${r.name}${r.notes ? " — " + r.notes : ""}`, 70);
    add(r.person_id, relationLabel(r.relation), r.notes, 25);
  }
  for (const f of db.facts) add(f.person_id, factMeta(f.category).label, f.content, 55);
  for (const i of db.interactions) {
    add(i.person_id, kindMeta(i.kind).label, i.title, 35);
    add(i.person_id, kindMeta(i.kind).label, i.notes, 30);
    add(i.person_id, kindMeta(i.kind).label, i.location, 25);
  }
  for (const pt of db.person_tags) add(pt.person_id, t("Tag"), tagName.get(pt.tag_id), 65);

  return [...hits.values()].sort((a, b) => b.score - a.score || a.person.full_name.localeCompare(b.person.full_name));
}
