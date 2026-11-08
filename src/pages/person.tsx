import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bell, Briefcase, Cake, Camera, Check, Heart, Mail, MapPin, MessageCircle, MessageSquarePlus, MoreHorizontal,
  Pencil, Phone, Plus, Sparkles, Star, StickyNote, Tag, Trash2, Users,
} from "lucide-react";
import { useData } from "@/state/data";
import { useConfirm } from "@/components/confirm";
import { Avatar, PersonAvatar } from "@/components/avatar";
import { toAvatarJpeg } from "@/lib/image";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Empty, Section } from "@/components/ui/card";
import { Menu } from "@/components/ui/menu";
import { FactForm, InteractionForm, JobForm, PersonForm, RelationForm, ReminderForm, TagsForm } from "@/components/forms";
import { FACT_CATEGORIES, currentJob, jobLabel, factMeta, firstName, kindMeta, lastInteraction, relationLabel, relationsFor } from "@/lib/insights";
import { advance, ageFrom, ago, daysUntil, fmt, formatBirthday, nextBirthday, relativeDays, todayISO } from "@/lib/dates";
import type { Fact, Interaction, Job, Relationship, Reminder } from "@/lib/types";
import { cn } from "@/lib/utils";

function ItemMenu({ onEdit, onDelete }: { onEdit(): void; onDelete(): void }) {
  return (
    <Menu
      trigger={<button className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100" aria-label={t("More")}><MoreHorizontal className="size-4" /></button>}
      items={[{ label: "Edit", icon: <Pencil />, onSelect: onEdit }, { label: "Delete", icon: <Trash2 />, onSelect: onDelete, danger: true }]}
    />
  );
}

const AddBtn = ({ onClick, label = t("Add") }: { onClick(): void; label?: string }) => (
  <Button size="sm" variant="ghost" onClick={onClick} className="-mr-2 text-muted-foreground"><Plus />{label}</Button>
);

function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col gap-1 p-3.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
      {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
    </Card>
  );
}

export function PersonPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const confirm = useConfirm();
  const { db, personById, update, remove, setPhoto } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const person = personById.get(id);

  const [edit, setEdit] = useState(false);
  const [tags, setTags] = useState(false);
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [rel, setRel] = useState<Relationship | null | undefined>(undefined);
  const [fact, setFact] = useState<Fact | null | undefined>(undefined);
  const [meet, setMeet] = useState<Interaction | null | undefined>(undefined);
  const [rem, setRem] = useState<Reminder | null | undefined>(undefined);
  const [showAllMeetings, setShowAllMeetings] = useState(false);

  if (!person) {
    return <div className="p-10"><Empty title={t("Person not found")} action={<Button onClick={() => nav("/people")}>{t("Back to people")}</Button>} /></div>;
  }

  const jobs = db.jobs.filter((j) => j.person_id === id).sort((a, b) => Number(b.is_current) - Number(a.is_current) || (b.start_date ?? "").localeCompare(a.start_date ?? ""));
  const nowJob = currentJob(db.jobs, id);
  const relations = relationsFor(db, id);
  const facts = db.facts.filter((f) => f.person_id === id);
  const meetings = db.interactions.filter((i) => i.person_id === id).sort((a, b) => b.date.localeCompare(a.date));
  const reminders = db.reminders.filter((r) => r.person_id === id && !r.done).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const tagIds = new Set(db.person_tags.filter((pt) => pt.person_id === id).map((pt) => pt.tag_id));
  const personTags = db.tags.filter((tg) => tagIds.has(tg.id));
  const last = lastInteraction(db.interactions, id);
  const bday = nextBirthday(person.birthday);
  const age = ageFrom(person.birthday);

  const del = async (what: string, fn: () => Promise<void>) => {
    if (await confirm({ title: what, text: t("This can't be undone.") })) await fn().catch(() => {});
  };
  const deletePerson = async () => {
    if (await confirm({ title: t("Delete {name}?", { name: person.full_name }), text: t("Their details, family, meetings and reminders will be deleted too. This can't be undone.") })) {
      await remove("people", id).then(() => nav("/people")).catch(() => {});
    }
  };
  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await setPhoto(id, await toAvatarJpeg(file));
    } catch {
      toast.error(t("Couldn't use that photo"));
    } finally {
      setUploading(false);
    }
  };
  const completeReminder = (r: Reminder) =>
    r.repeat !== "none" ? update("reminders", r.id, { due_date: advance(r.due_date, r.repeat) }) : update("reminders", r.id, { done: true });

  const byCategory = FACT_CATEGORIES.map((c) => ({ ...c, items: facts.filter((f) => (factMeta(f.category).value) === c.value) })).filter((g) => g.items.length);
  const family = relations.filter((r) => ["child", "spouse", "partner", "parent", "sibling", "relative", "pet", "owner"].includes(r.relation));
  const network = relations.filter((r) => !family.includes(r));
  const visibleMeetings = showAllMeetings ? meetings : meetings.slice(0, 4);

  const RelRow = ({ r }: { r: (typeof relations)[number] }) => {
    const linked = r.related_person_id ? personById.get(r.related_person_id) : null;
    const name = linked?.full_name ?? r.name ?? "?";
    const b = !linked ? nextBirthday(r.birthday) : null;
    const a = !linked ? ageFrom(r.birthday) : undefined;
    const body = (
      <>
        {linked ? <PersonAvatar person={linked} size={36} /> : <Avatar name={name} size={36} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}{a !== undefined && <span className="font-normal text-muted-foreground"> · {a}</span>}</p>
          <p className="truncate text-xs text-muted-foreground">
            {relationLabel(r.relation)}{b && ` · 🎂 ${formatBirthday(r.birthday)}${b.inDays <= 30 ? ` (${relativeDays(b.inDays)})` : ""}`}{r.notes && ` · ${r.notes}`}
          </p>
        </div>
      </>
    );
    return (
      <li className="flex items-center gap-1">
        {linked
          ? <Link to={`/people/${linked.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted">{body}</Link>
          : <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5">{body}</div>}
        {!r.incoming && (
          <ItemMenu onEdit={() => setRel(db.relationships.find((x) => x.id === r.id)!)} onDelete={() => del(t("Delete this relationship?"), () => remove("relationships", r.id))} />
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-6 md:px-6">
      {/* Top bar */}
      <div className="pt-safe sticky top-0 z-10 -mx-4 flex items-center justify-between bg-background/85 px-2 py-2 backdrop-blur-xl md:static md:mx-0 md:bg-transparent md:px-0 md:pt-6">
        <Button variant="ghost" size="icon" onClick={() => (history.length > 1 ? nav(-1) : nav("/people"))} aria-label={t("Back")}><ArrowLeft className="!size-5" /></Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={t("Favorite")} onClick={() => update("people", id, { favorite: !person.favorite })}>
            <Star className={cn("!size-5", person.favorite && "fill-amber-400 text-amber-400")} />
          </Button>
          <Menu
            trigger={<Button variant="ghost" size="icon" aria-label={t("More")}><MoreHorizontal className="!size-5" /></Button>}
            items={[
              { label: "Edit profile", icon: <Pencil />, onSelect: () => setEdit(true) },
              { label: "Edit tags", icon: <Tag />, onSelect: () => setTags(true) },
              { label: "Delete person", icon: <Trash2 />, onSelect: deletePerson, danger: true },
            ]}
          />
        </div>
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center pt-2 text-center md:flex-row md:items-center md:gap-5 md:text-left">
        <Menu align="start"
          trigger={
            <button className="group relative rounded-full" aria-label={t("Change photo")}>
              <PersonAvatar person={person} size={88} className="shadow-lg ring-4 ring-background" />
              <span className="absolute bottom-0 right-0 grid size-7 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow">
                {uploading ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera className="size-3.5" />}
              </span>
            </button>
          }
          items={[
            { label: person.photo_path ? t("Change photo") : t("Add photo"), icon: <Camera />, onSelect: () => fileRef.current?.click() },
            ...(person.photo_path ? [{ label: t("Remove photo"), icon: <Trash2 />, danger: true, onSelect: () => { setPhoto(id, null); } }] : []),
          ]}
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        <div className="mt-3 min-w-0 md:mt-0">
          <h1 className="text-2xl font-semibold tracking-tight">{person.full_name}</h1>
          {person.nickname && <p className="text-sm text-muted-foreground">“{person.nickname}”</p>}
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground md:justify-start">
            {nowJob && <span className="inline-flex items-center gap-1"><Briefcase className="size-3.5" />{jobLabel(nowJob)}</span>}
            {person.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{person.city}</span>}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 md:justify-start">
            {personTags.map((tg) => <Badge key={tg.id} color={tg.color}>{tg.name}</Badge>)}
            <button onClick={() => setTags(true)} className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted">
              {personTags.length ? t("Edit tags") : t("+ Add tag")}
            </button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {[
          { icon: <Phone />, label: t("Call"), href: person.phone ? `tel:${person.phone}` : undefined },
          { icon: <MessageCircle />, label: t("Text"), href: person.phone ? `sms:${person.phone}` : undefined },
          { icon: <Mail />, label: t("Email"), href: person.email ? `mailto:${person.email}` : undefined },
        ].map((a) => (
          <a key={a.label} href={a.href} aria-disabled={!a.href}
            className={cn("flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 text-xs font-medium transition hover:bg-muted [&_svg]:size-5 [&_svg]:text-primary",
              !a.href && "pointer-events-none opacity-40")}>
            {a.icon}{a.label}
          </a>
        ))}
        <button onClick={() => setMeet(null)}
          className="flex flex-col items-center gap-1 rounded-2xl bg-primary py-3 text-xs font-medium text-primary-foreground shadow-md shadow-primary/25 transition active:scale-95 [&_svg]:size-5">
          <MessageSquarePlus />{t("Log")}
        </button>
      </div>

      {/* Key stats */}
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat icon={<Cake />} label={t("Birthday")} value={person.birthday ? formatBirthday(person.birthday) : "—"}
          sub={bday ? `${bday.inDays === 0 ? t("Today! 🎉") : relativeDays(bday.inDays)}${age !== undefined ? ` · ${t("{n} y/o", { n: age })}` : ""}` : <button className="text-primary" onClick={() => setEdit(true)}>{t("Add")}</button>} />
        <Stat icon={<MessageCircle />} label={t("Last talked")} value={last ? ago(last.date) : t("Never")} sub={last ? kindMeta(last.kind).label : undefined} />
        <Stat icon={<Heart />} label={t("How we met")} value={person.how_we_met || "—"} />
        <Stat icon={<Bell />} label={t("Stay in touch")} value={person.keep_in_touch_days ? t("Every {n} days", { n: person.keep_in_touch_days }) : t("Off")}
          sub={person.keep_in_touch_days && last ? (() => { const d = person.keep_in_touch_days! - Math.round((Date.now() - new Date(last.date).getTime()) / 864e5); return d < 0 ? t("{n} days overdue", { n: -d }) : t("due {when}", { when: relativeDays(d) }); })() : undefined} />
      </div>

      <div className="mt-4 grid gap-4">
        {/* Small details */}
        <Section title={t("Small details")} icon={<Sparkles />} action={<AddBtn onClick={() => setFact(null)} />}>
          {facts.length === 0 ? (
            <Empty title={t("What does {name} like?", { name: firstName(person) })} text={t("Coffee order, allergies, hobbies, gift ideas, the dog's name…")}
              action={<Button size="sm" variant="secondary" onClick={() => setFact(null)}><Plus /> {t("Add a detail")}</Button>} />
          ) : (
            <div className="grid gap-3">
              {byCategory.map((g) => (
                <div key={g.value}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{g.emoji} {g.label}</p>
                  <ul className="grid gap-1">
                    {g.items.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 rounded-xl bg-muted/60 py-1 pl-3 pr-1 text-sm">
                        <span className="flex-1">{f.content}</span>
                        <ItemMenu onEdit={() => setFact(f)} onDelete={() => del(t("Delete this detail?"), () => remove("facts", f.id))} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Family */}
          <Section title={t("Family")} icon={<Heart />} action={<AddBtn onClick={() => setRel(null)} />}>
            {family.length === 0
              ? <p className="text-sm text-muted-foreground">{t("Spouse, children, pets…")} <button className="text-primary" onClick={() => setRel(null)}>{t("Add")}</button></p>
              : <ul className="-mx-2 grid gap-0.5">{family.map((r) => <RelRow key={r.id + String(r.incoming)} r={r} />)}</ul>}
          </Section>

          {/* Connections */}
          <Section title={t("Connections")} icon={<Users />} action={<AddBtn onClick={() => setRel(null)} />}>
            {network.length === 0
              ? <p className="text-sm text-muted-foreground">{t("Colleagues, friends, who introduced you.")} <button className="text-primary" onClick={() => setRel(null)}>{t("Link someone")}</button></p>
              : <ul className="-mx-2 grid gap-0.5">{network.map((r) => <RelRow key={r.id + String(r.incoming)} r={r} />)}</ul>}
          </Section>
        </div>

        {/* Meetings */}
        <Section title={t("Meetings & notes")} icon={<MessageCircle />} action={<AddBtn onClick={() => setMeet(null)} label={t("Log")} />}>
          {meetings.length === 0 ? (
            <Empty title={t("No meetings yet")} text={t("Log what you talked about so you remember next time.")}
              action={<Button size="sm" onClick={() => setMeet(null)}><MessageSquarePlus /> {t("Log a meeting")}</Button>} />
          ) : (
            <>
              <ol className="relative grid gap-4 border-l pl-5 ml-2">
                {visibleMeetings.map((m) => (
                  <li key={m.id} className="relative">
                    <span className="absolute -left-[31px] top-0 grid size-5 place-items-center rounded-full bg-card text-xs ring-4 ring-card">{kindMeta(m.kind).emoji}</span>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{m.title || kindMeta(m.kind).label}</p>
                        <p className="text-xs text-muted-foreground">{fmt(m.date, "date")} · {ago(m.date)}{m.location && ` · ${m.location}`}</p>
                        {m.notes && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{m.notes}</p>}
                      </div>
                      <ItemMenu onEdit={() => setMeet(m)} onDelete={() => del(t("Delete this meeting?"), () => remove("interactions", m.id))} />
                    </div>
                  </li>
                ))}
              </ol>
              {meetings.length > 4 && (
                <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setShowAllMeetings(!showAllMeetings)}>
                  {showAllMeetings ? t("Show less") : t("Show all {n}", { n: meetings.length })}
                </Button>
              )}
            </>
          )}
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Work */}
          <Section title={t("Work")} icon={<Briefcase />} action={<AddBtn onClick={() => setJob(null)} />}>
            {jobs.length === 0 ? <p className="text-sm text-muted-foreground">{t("Where do they work?")} <button className="text-primary" onClick={() => setJob(null)}>{t("Add")}</button></p> : (
              <ul className="grid gap-3">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-start gap-3">
                    <div className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold", j.is_current ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                      {j.company[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{j.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {[j.title, [j.start_date, j.is_current ? t("now") : j.end_date].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")}
                      </p>
                      {j.notes && <p className="mt-0.5 text-xs text-muted-foreground">{j.notes}</p>}
                    </div>
                    <ItemMenu onEdit={() => setJob(j)} onDelete={() => del(t("Delete this job?"), () => remove("jobs", j.id))} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Reminders */}
          <Section title={t("Reminders")} icon={<Bell />} action={<AddBtn onClick={() => setRem(null)} />}>
            {reminders.length === 0 ? <p className="text-sm text-muted-foreground">{t("No open reminders.")}</p> : (
              <ul className="grid gap-1">
                {reminders.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <button onClick={() => completeReminder(r)} aria-label={t("Mark done")}
                      className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-muted-foreground/40 text-transparent transition hover:border-primary hover:text-primary">
                      <Check className="size-3.5" strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.title}</p>
                      <p className={cn("text-xs text-muted-foreground", r.due_date < todayISO() && "text-destructive")}>
                        {relativeDays(daysUntil(r.due_date))}{r.repeat !== "none" && ` · ${t(r.repeat === "monthly" ? "Monthly" : "Yearly")}`}
                      </p>
                    </div>
                    <ItemMenu onEdit={() => setRem(r)} onDelete={() => del(t("Delete this reminder?"), () => remove("reminders", r.id))} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Notes & contact */}
        <Section title={t("Notes")} icon={<StickyNote />} action={<Button size="sm" variant="ghost" className="-mr-2 text-muted-foreground" onClick={() => setEdit(true)}><Pencil />{t("Edit")}</Button>}>
          {person.notes ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{person.notes}</p> : <p className="text-sm text-muted-foreground">{t("No notes yet.")}</p>}
          {(person.phone || person.email) && (
            <div className="mt-4 grid gap-1 border-t pt-3 text-sm">
              {person.phone && <a href={`tel:${person.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Phone className="size-3.5" />{person.phone}</a>}
              {person.email && <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Mail className="size-3.5" />{person.email}</a>}
            </div>
          )}
        </Section>
      </div>

      <PersonForm open={edit} onOpenChange={setEdit} initial={person} />
      <TagsForm open={tags} onOpenChange={setTags} personId={id} />
      <JobForm open={job !== undefined} onOpenChange={(o) => !o && setJob(undefined)} initial={job} personId={id} />
      <RelationForm open={rel !== undefined} onOpenChange={(o) => !o && setRel(undefined)} initial={rel} personId={id} />
      <FactForm open={fact !== undefined} onOpenChange={(o) => !o && setFact(undefined)} initial={fact} personId={id} />
      <InteractionForm open={meet !== undefined} onOpenChange={(o) => !o && setMeet(undefined)} initial={meet} personId={id} />
      <ReminderForm open={rem !== undefined} onOpenChange={(o) => !o && setRem(undefined)} initial={rem} personId={id} />
    </div>
  );
}
