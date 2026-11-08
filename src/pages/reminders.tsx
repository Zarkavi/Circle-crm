import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Cake, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useData } from "@/state/data";
import { useQuickAdd } from "@/components/quick-add";
import { PageHeader } from "@/components/shell";
import { Empty, Section } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { advance, daysUntil, fmtDate, relativeDays, todayISO } from "@/lib/dates";
import { upcomingBirthdays } from "@/lib/insights";
import type { Reminder } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RemindersPage() {
  const { db, personById, update, remove } = useData();
  const qa = useQuickAdd();
  const [showDone, setShowDone] = useState(false);
  const today = todayISO();
  const open = db.reminders.filter((r) => !r.done).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const done = db.reminders.filter((r) => r.done).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const groups = [
    { title: "Overdue", items: open.filter((r) => r.due_date < today) },
    { title: "Today", items: open.filter((r) => r.due_date === today) },
    { title: "Next 7 days", items: open.filter((r) => r.due_date > today && daysUntil(r.due_date) <= 7) },
    { title: "Later", items: open.filter((r) => daysUntil(r.due_date) > 7) },
  ].filter((g) => g.items.length);
  const birthdays = upcomingBirthdays(db, 60);

  const complete = (r: Reminder) =>
    r.repeat !== "none" ? update("reminders", r.id, { due_date: advance(r.due_date, r.repeat) }) : update("reminders", r.id, { done: true });

  const Row = ({ r }: { r: Reminder }) => {
    const p = r.person_id ? personById.get(r.person_id) : null;
    return (
      <li className="flex items-center gap-3 py-1.5">
        {r.done ? (
          <button onClick={() => update("reminders", r.id, { done: false })} aria-label="Reopen" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" strokeWidth={3} /></button>
        ) : (
          <button onClick={() => complete(r)} aria-label="Mark done" className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-muted-foreground/40 text-transparent transition hover:border-primary hover:text-primary"><Check className="size-3.5" strokeWidth={3} /></button>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm", r.done && "text-muted-foreground line-through")}>{r.title}</p>
          <p className={cn("text-xs text-muted-foreground", !r.done && r.due_date < today && "text-destructive")}>
            {fmtDate(r.due_date, "EEE, MMM d")} · {relativeDays(daysUntil(r.due_date))}
            {r.repeat !== "none" && <> · <RotateCcw className="inline size-3" /> {r.repeat}</>}
            {p && <> · <Link to={`/people/${p.id}`} className="hover:underline">{p.full_name}</Link></>}
          </p>
        </div>
        <button onClick={() => remove("reminders", r.id)} aria-label="Delete" className="grid size-8 place-items-center rounded-lg text-muted-foreground opacity-50 hover:bg-muted hover:opacity-100"><Trash2 className="size-4" /></button>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Reminders" subtitle={`${open.length} open`} action={<Button size="sm" onClick={qa.newReminder}><Plus /> New</Button>} />
      <div className="mx-auto grid max-w-3xl gap-4 px-4 pt-2 md:px-6">
        {groups.length === 0 ? (
          <Section title="All clear" icon={<Bell />}>
            <Empty title="No open reminders" text="Add follow-ups when you log a meeting, or create one here." action={<Button size="sm" onClick={qa.newReminder}><Plus /> New reminder</Button>} />
          </Section>
        ) : groups.map((g) => (
          <Section key={g.title} title={g.title} icon={<Bell />} className={g.title === "Overdue" ? "border-destructive/30" : ""}>
            <ul className="divide-y">{g.items.map((r) => <Row key={r.id} r={r} />)}</ul>
          </Section>
        ))}

        <Section title="Birthdays, next 60 days" icon={<Cake />}>
          {birthdays.length === 0 ? <p className="text-sm text-muted-foreground">None coming up. Add birthdays to people and their kids to see them here.</p> : (
            <ul className="divide-y">
              {birthdays.map((b) => (
                <li key={b.key} className="flex items-center justify-between gap-3 py-2">
                  <Link to={`/people/${b.personId}`} className="min-w-0 hover:underline">
                    <p className="truncate text-sm font-medium">{b.name}{b.turning ? ` turns ${b.turning}` : ""}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.via ?? "Birthday"} · {format(b.date, "EEE, MMM d")}</p>
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{b.inDays === 0 ? "Today 🎂" : relativeDays(b.inDays)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {done.length > 0 && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setShowDone(!showDone)}>{showDone ? "Hide" : "Show"} completed ({done.length})</Button>
            {showDone && <Section title="Completed" className="mt-2"><ul className="divide-y">{done.map((r) => <Row key={r.id} r={r} />)}</ul></Section>}
          </div>
        )}
      </div>
    </>
  );
}
