import { useMemo, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { useData } from "@/state/data";
import { useQuickAdd } from "@/components/quick-add";
import { PageHeader } from "@/components/shell";
import { Card, Empty } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PersonRow } from "@/components/person-row";
import { currentJob, lastInteraction } from "@/lib/insights";
import { ago } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Sort = "name" | "recent" | "oldest";

export function PeoplePage() {
  const { db } = useData();
  const qa = useQuickAdd();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem("circle-sort") as Sort) || "name");

  const rows = useMemo(() => {
    const tagged = tag ? new Set(db.person_tags.filter((pt) => pt.tag_id === tag).map((pt) => pt.person_id)) : null;
    const needle = q.trim().toLowerCase();
    const list = db.people
      .filter((p) => !tagged || tagged.has(p.id))
      .filter((p) => !favOnly || p.favorite)
      .map((p) => ({ p, job: currentJob(db.jobs, p.id), last: lastInteraction(db.interactions, p.id) }))
      .filter(({ p, job }) => !needle || [p.full_name, p.nickname, p.city, job?.company].some((s) => s?.toLowerCase().includes(needle)));
    list.sort((a, b) => {
      if (sort === "name") return a.p.full_name.localeCompare(b.p.full_name);
      const ad = a.last?.date ?? "0000", bd = b.last?.date ?? "0000";
      return sort === "recent" ? bd.localeCompare(ad) : ad.localeCompare(bd);
    });
    return list;
  }, [db, q, tag, favOnly, sort]);

  const groups = useMemo(() => {
    if (sort !== "name") return [["", rows]] as const;
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.p.full_name[0]?.toUpperCase() ?? "#";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows, sort]);

  const chip = (active: boolean) => cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition", active ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted");

  return (
    <>
      <PageHeader title="People" subtitle={`${db.people.length} ${db.people.length === 1 ? "person" : "people"}`}
        action={<Button size="sm" onClick={qa.newPerson} className="hidden md:inline-flex"><UserPlus /> New</Button>} />
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="sticky top-0 z-10 -mx-4 bg-background/85 px-4 py-2 backdrop-blur-xl md:static md:mx-0 md:bg-transparent md:px-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, company, city" className="pl-9" />
            </div>
            <Select value={sort} onChange={(e) => { setSort(e.target.value as Sort); try { localStorage.setItem("circle-sort", e.target.value); } catch {} }} className="w-auto" aria-label="Sort">
              <option value="name">A–Z</option>
              <option value="recent">Recently met</option>
              <option value="oldest">Longest ago</option>
            </Select>
          </div>
          <div className="scrollbar-none -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
            <button className={chip(!tag && !favOnly)} onClick={() => { setTag(null); setFavOnly(false); }}>All</button>
            <button className={chip(favOnly)} onClick={() => setFavOnly(!favOnly)}>★ Favorites</button>
            {[...db.tags].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
              <button key={t.id} onClick={() => setTag(tag === t.id ? null : t.id)} className="shrink-0">
                <Badge color={t.color} className={cn("px-3 py-1.5", tag && tag !== t.id && "opacity-50")}>{t.name}</Badge>
              </button>
            ))}
          </div>
        </div>

        <Card className="mt-2 p-2">
          {rows.length === 0 ? (
            db.people.length === 0
              ? <Empty icon={<Users />} title="No one here yet" text="Add people you want to remember details about." action={<Button onClick={qa.newPerson}><UserPlus /> Add person</Button>} />
              : <Empty icon={<Search />} title="No matches" text="Try a different filter, or use Search to look inside notes." />
          ) : groups.map(([letter, list]) => (
            <div key={letter}>
              {letter && <div className="px-2 pb-1 pt-3 text-xs font-semibold text-muted-foreground first:pt-1">{letter}</div>}
              {list.map(({ p, job, last }) => (
                <PersonRow key={p.id} person={p}
                  sub={[job && [job.title, job.company].filter(Boolean).join(" at "), p.city].filter(Boolean).join(" · ") || p.how_we_met || "—"}
                  right={last && <span className="shrink-0 text-xs text-muted-foreground">{ago(last.date)}</span>} />
              ))}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
