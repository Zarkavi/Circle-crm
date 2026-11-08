import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useData } from "@/state/data";
import { PageHeader } from "@/components/shell";
import { Card, Empty } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersonRow } from "@/components/person-row";
import { searchAll } from "@/lib/insights";
import { t } from "@/lib/i18n";

function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-primary/20 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}


export function SearchPage() {
  const { db } = useData();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (window.matchMedia("(min-width: 768px)").matches) ref.current?.focus(); }, []);
  useEffect(() => { setParams(q ? { q } : {}, { replace: true }); }, [q, setParams]);
  const hits = useMemo(() => searchAll(db, q), [db, q]);
  // Suggestions come from your own data: tags, companies and cities.
  const examples = useMemo(() => {
    const seen = new Set<string>();
    const add = (s?: string | null) => { if (s && !seen.has(s.toLowerCase()) && seen.size < 8) seen.add(s) ; };
    db.tags.forEach((x) => add(x.name));
    db.jobs.filter((j) => j.is_current).forEach((j) => add(j.company));
    db.people.forEach((p) => add(p.city));
    return [...seen];
  }, [db]);

  return (
    <>
      <PageHeader title={t("Search")} subtitle={t("Names, kids, companies, notes, small details: everything.")} />
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input ref={ref} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Who has a dog named Max?")} className="h-12 rounded-2xl pl-11 text-base" />
        </div>
        {!q.trim() ? (
          examples.length > 0 && <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t("Try")}</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((e) => (
                <button key={e} onClick={() => setQ(e)} className="rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">{e}</button>
              ))}
            </div>
          </div>
        ) : hits.length === 0 ? (
          <Card className="mt-4"><Empty icon={<Search />} title={t("Nothing for “{q}”", { q })} text={t("Search looks through every note, meeting, detail and family member.")} /></Card>
        ) : (
          <Card className="mt-4 p-2">
            <p className="px-2 pb-1 pt-1 text-xs text-muted-foreground">{t(hits.length === 1 ? "{n} person" : "{n} people", { n: hits.length })}</p>
            {hits.map((h) => (
              <PersonRow key={h.person.id} person={h.person}
                sub={<><span className="font-medium text-foreground/70">{h.where}:</span> <Highlight text={h.snippet} q={q.trim()} /></>} />
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
