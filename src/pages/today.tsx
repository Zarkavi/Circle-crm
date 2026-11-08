import { Link } from "react-router-dom";
import { Bell, Cake, Check, Clock, History, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { useData } from "@/state/data";
import { useQuickAdd } from "@/components/quick-add";
import { PageHeader } from "@/components/shell";
import { Empty, Section } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { PersonRow } from "@/components/person-row";
import { firstName, keepInTouchDue, kindMeta, upcomingBirthdays } from "@/lib/insights";
import { ago, advance, daysUntil, relativeDays, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function TodayPage() {
  const { db, personById, update } = useData();
  const qa = useQuickAdd();
  const today = todayISO();
  const birthdays = upcomingBirthdays(db, 30);
  const nudges = keepInTouchDue(db).slice(0, 6);
  const reminders = db.reminders
    .filter((r) => !r.done && daysUntil(r.due_date) <= 7)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const recent = [...db.interactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const complete = async (id: string) => {
    const r = db.reminders.find((x) => x.id === id)!;
    if (r.repeat !== "none") await update("reminders", id, { due_date: advance(r.due_date, r.repeat) });
    else await update("reminders", id, { done: true });
  };

  if (db.people.length === 0) {
    return (
      <>
        <PageHeader title={greeting()} subtitle={format(new Date(), "EEEE, MMMM d")} />
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <Section title="Get started">
            <Empty icon={<UserPlus />} title="Add the first person"
              text="Start with someone you met recently: their kids' names, where they work, what they like."
              action={<Button onClick={qa.newPerson}><UserPlus /> Add person</Button>} />
          </Section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={greeting()} subtitle={format(new Date(), "EEEE, MMMM d")} />
      <div className="mx-auto grid max-w-3xl gap-4 px-4 pt-2 md:grid-cols-2 md:px-6">
        <Section title="Reminders" icon={<Bell />} className="md:col-span-2"
          action={<Link to="/reminders" className="text-xs text-muted-foreground hover:text-foreground">See all</Link>}>
          {reminders.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Nothing due this week. 🎉</p> : (
            <ul className="-mx-1 grid gap-0.5">
              {reminders.map((r) => {
                const p = r.person_id ? personById.get(r.person_id) : null;
                const d = daysUntil(r.due_date);
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <button onClick={() => complete(r.id)} aria-label="Mark done"
                      className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-muted-foreground/40 text-transparent transition hover:border-primary hover:text-primary">
                      <Check className="size-3.5" strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.title}</p>
                      <p className={cn("text-xs text-muted-foreground", r.due_date < today && "text-destructive")}>
                        {r.due_date < today ? `Overdue · ${relativeDays(d)}` : relativeDays(d)}
                        {p && <> · <Link className="hover:underline" to={`/people/${p.id}`}>{p.full_name}</Link></>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Upcoming birthdays" icon={<Cake />}>
          {birthdays.length === 0 ? <p className="py-2 text-sm text-muted-foreground">None in the next 30 days.</p> : (
            <ul className="-mx-2 grid gap-0.5">
              {birthdays.slice(0, 6).map((b) => (
                <li key={b.key}>
                  <Link to={`/people/${b.personId}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
                    <Avatar name={b.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.via ?? format(b.date, "EEE, MMM d")}{b.turning ? ` · turns ${b.turning}` : ""}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", b.inDays <= 7 ? "bg-rose-500/12 text-rose-600 dark:text-rose-300" : "bg-muted text-muted-foreground")}>
                      {b.inDays === 0 ? "Today 🎂" : relativeDays(b.inDays)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Time to reach out" icon={<Clock />}>
          {nudges.length === 0 ? <p className="py-2 text-sm text-muted-foreground">You're on top of everyone.</p> : (
            <ul className="-mx-2 grid gap-0.5">
              {nudges.map(({ person, daysSince }) => (
                <li key={person.id}>
                  <PersonRow person={person}
                    sub={daysSince === null ? "No meetings logged yet" : `Last talked ${daysSince} days ago`}
                    right={<Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); qa.logMeeting(person.id); }}>Log</Button>} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent meetings" icon={<History />} className="md:col-span-2">
          {recent.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Log your first meeting with the + button.</p> : (
            <ul className="grid gap-3">
              {recent.map((i) => {
                const p = personById.get(i.person_id);
                if (!p) return null;
                return (
                  <li key={i.id}>
                    <Link to={`/people/${p.id}`} className="flex gap-3 rounded-xl hover:opacity-80">
                      <Avatar name={p.full_name} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm"><span className="font-medium">{firstName(p)}</span>
                          <span className="text-muted-foreground"> · {kindMeta(i.kind).emoji} {i.title || kindMeta(i.kind).label} · {ago(i.date)}</span></p>
                        {i.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{i.notes}</p>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
