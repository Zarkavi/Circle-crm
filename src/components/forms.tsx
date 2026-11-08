import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge, TAG_DOTS } from "@/components/ui/badge";
import { BirthdayInput } from "@/components/birthday-input";
import { useData } from "@/state/data";
import { todayISO } from "@/lib/dates";
import { FACT_CATEGORIES, INTERACTION_KINDS, RELATIONS, TAG_COLORS } from "@/lib/insights";
import type { Fact, Interaction, Job, Person, Relationship, Reminder } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FormProps<T> {
  open: boolean;
  onOpenChange(o: boolean): void;
  initial?: T | null;
  onSaved?(row: T): void;
}

/** Shared shell: form state resets whenever the sheet opens. */
function useFormState<T extends object>(open: boolean, make: () => T) {
  const [v, setV] = useState<T>(make);
  useEffect(() => { if (open) setV(make()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof T>(k: K, val: T[K]) => setV((s) => ({ ...s, [k]: val }));
  return [v, set, setV] as const;
}

function FormSheet({ open, onOpenChange, title, onSubmit, saving, children, submitLabel = "Save" }: {
  open: boolean; onOpenChange(o: boolean): void; title: string; onSubmit(): void; saving: boolean; children: ReactNode; submitLabel?: string;
}) {
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(); };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}
      footer={<>
        <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="submit" form="sheet-form" className="flex-1" disabled={saving}>{saving ? "Saving…" : submitLabel}</Button>
      </>}>
      <form id="sheet-form" onSubmit={submit} className="grid gap-4 pb-2">{children}</form>
    </Sheet>
  );
}

const blank = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

function useSaver() {
  const [saving, setSaving] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try { await fn(); } catch { /* toast shown by data layer */ } finally { setSaving(false); }
  };
  return [saving, run] as const;
}

export function PersonPicker({ value, onChange, exclude, placeholder = "Choose a person" }: {
  value: string; onChange(id: string): void; exclude?: string; placeholder?: string;
}) {
  const { db } = useData();
  const people = [...db.people].filter((p) => p.id !== exclude).sort((a, b) => a.full_name.localeCompare(b.full_name));
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
    </Select>
  );
}

// ---------------------------------------------------------------- Person
export function PersonForm({ open, onOpenChange, initial, onSaved }: FormProps<Person>) {
  const { create, update } = useData();
  const [saving, run] = useSaver();
  const [v, set] = useFormState(open, () => ({
    full_name: initial?.full_name ?? "", nickname: initial?.nickname ?? "", email: initial?.email ?? "",
    phone: initial?.phone ?? "", birthday: initial?.birthday ?? null, city: initial?.city ?? "",
    how_we_met: initial?.how_we_met ?? "", notes: initial?.notes ?? "",
    keep_in_touch_days: initial?.keep_in_touch_days ?? null as number | null,
    company: "", title: "",
  }));

  const save = () => run(async () => {
    if (!v.full_name.trim()) { toast.error("Name is required"); return; }
    const row = {
      full_name: v.full_name.trim(), nickname: blank(v.nickname), email: blank(v.email), phone: blank(v.phone),
      birthday: v.birthday, city: blank(v.city), how_we_met: blank(v.how_we_met), notes: blank(v.notes),
      keep_in_touch_days: v.keep_in_touch_days || null,
    };
    let saved: Person;
    if (initial) saved = await update("people", initial.id, row);
    else {
      saved = await create("people", { ...row, favorite: false });
      if (v.company.trim()) await create("jobs", { person_id: saved.id, company: v.company.trim(), title: blank(v.title), is_current: true });
    }
    toast.success(initial ? "Saved" : `${saved.full_name} added`);
    onOpenChange(false);
    onSaved?.(saved);
  });

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={initial ? "Edit person" : "New person"} onSubmit={save} saving={saving}>
      <Field label="Full name"><Input autoFocus value={v.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Anna Kowalski" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nickname"><Input value={v.nickname} onChange={(e) => set("nickname", e.target.value)} /></Field>
        <Field label="City"><Input value={v.city} onChange={(e) => set("city", e.target.value)} /></Field>
      </div>
      {!initial && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Works at"><Input value={v.company} onChange={(e) => set("company", e.target.value)} placeholder="Company" /></Field>
          <Field label="Role"><Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Job title" /></Field>
        </div>
      )}
      <Field label="Birthday"><BirthdayInput value={v.birthday} onChange={(b) => set("birthday", b)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><Input type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} /></Field>
      </div>
      <Field label="How we met"><Input value={v.how_we_met} onChange={(e) => set("how_we_met", e.target.value)} placeholder="Conference, intro from…, school" /></Field>
      <Field label="Stay in touch" hint="You'll get a nudge on the Today screen when it's been too long.">
        <Select value={v.keep_in_touch_days ?? ""} onChange={(e) => set("keep_in_touch_days", e.target.value ? Number(e.target.value) : null)}>
          <option value="">No reminder</option>
          <option value={7}>Every week</option>
          <option value={14}>Every 2 weeks</option>
          <option value={30}>Every month</option>
          <option value={60}>Every 2 months</option>
          <option value={90}>Every 3 months</option>
          <option value={180}>Every 6 months</option>
          <option value={365}>Every year</option>
        </Select>
      </Field>
      <Field label="Notes"><Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything worth remembering…" /></Field>
    </FormSheet>
  );
}

// ---------------------------------------------------------------- Job
export function JobForm({ open, onOpenChange, initial, personId }: FormProps<Job> & { personId: string }) {
  const { create, update } = useData();
  const [saving, run] = useSaver();
  const [v, set] = useFormState(open, () => ({
    company: initial?.company ?? "", title: initial?.title ?? "", start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "", is_current: initial?.is_current ?? true, notes: initial?.notes ?? "",
  }));
  const save = () => run(async () => {
    if (!v.company.trim()) { toast.error("Company is required"); return; }
    const row = { company: v.company.trim(), title: blank(v.title), start_date: blank(v.start_date),
      end_date: v.is_current ? null : blank(v.end_date), is_current: v.is_current, notes: blank(v.notes) };
    if (initial) await update("jobs", initial.id, row); else await create("jobs", { ...row, person_id: personId });
    onOpenChange(false);
  });
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={initial ? "Edit job" : "Add job"} onSubmit={save} saving={saving}>
      <Field label="Company"><Input autoFocus value={v.company} onChange={(e) => set("company", e.target.value)} /></Field>
      <Field label="Role"><Input value={v.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v.is_current} onChange={(e) => set("is_current", e.target.checked)} />
        Works here now
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From"><Input value={v.start_date} onChange={(e) => set("start_date", e.target.value)} placeholder="2021" /></Field>
        {!v.is_current && <Field label="To"><Input value={v.end_date} onChange={(e) => set("end_date", e.target.value)} placeholder="2023" /></Field>}
      </div>
      <Field label="Notes"><Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-16" placeholder="Team, projects, why they left…" /></Field>
    </FormSheet>
  );
}

// ---------------------------------------------------------------- Relationship
export function RelationForm({ open, onOpenChange, initial, personId }: FormProps<Relationship> & { personId: string }) {
  const { create, update } = useData();
  const [saving, run] = useSaver();
  const [v, set] = useFormState(open, () => ({
    relation: initial?.relation ?? "child",
    mode: (initial?.related_person_id ? "link" : "name") as "link" | "name",
    related_person_id: initial?.related_person_id ?? "", name: initial?.name ?? "",
    birthday: initial?.birthday ?? null, notes: initial?.notes ?? "",
  }));
  const save = () => run(async () => {
    if (v.mode === "link" && !v.related_person_id) { toast.error("Pick a person"); return; }
    if (v.mode === "name" && !v.name.trim()) { toast.error("Name is required"); return; }
    const row = {
      relation: v.relation,
      related_person_id: v.mode === "link" ? v.related_person_id : null,
      name: v.mode === "name" ? v.name.trim() : null,
      birthday: v.mode === "name" ? v.birthday : null,
      notes: blank(v.notes),
    };
    if (initial) await update("relationships", initial.id, row); else await create("relationships", { ...row, person_id: personId });
    onOpenChange(false);
  });
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={initial ? "Edit relationship" : "Add family or connection"} onSubmit={save} saving={saving}>
      <Field label="Relationship">
        <Select value={v.relation} onChange={(e) => set("relation", e.target.value)}>
          {RELATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
        {(["name", "link"] as const).map((m) => (
          <button type="button" key={m} onClick={() => set("mode", m)}
            className={cn("rounded-lg py-1.5 font-medium transition", v.mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {m === "name" ? "Just a name" : "Someone in Circle"}
          </button>
        ))}
      </div>
      {v.mode === "link" ? (
        <Field label="Person" hint="The link shows up on both people's pages.">
          <PersonPicker value={v.related_person_id} onChange={(id) => set("related_person_id", id)} exclude={personId} />
        </Field>
      ) : (
        <>
          <Field label="Name"><Input autoFocus value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Zosia" /></Field>
          <Field label="Birthday"><BirthdayInput value={v.birthday} onChange={(b) => set("birthday", b)} /></Field>
        </>
      )}
      <Field label="Details"><Textarea className="min-h-16" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Loves horses, goes to school X…" /></Field>
    </FormSheet>
  );
}

// ---------------------------------------------------------------- Fact
export function FactForm({ open, onOpenChange, initial, personId }: FormProps<Fact> & { personId: string }) {
  const { create, update } = useData();
  const [saving, run] = useSaver();
  const [v, set] = useFormState(open, () => ({ category: initial?.category ?? "other", content: initial?.content ?? "" }));
  const save = () => run(async () => {
    if (!v.content.trim()) { toast.error("Write the detail"); return; }
    const row = { category: v.category, content: v.content.trim() };
    if (initial) await update("facts", initial.id, row); else await create("facts", { ...row, person_id: personId });
    onOpenChange(false);
  });
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={initial ? "Edit detail" : "Add a small detail"} onSubmit={save} saving={saving}>
      <div className="flex flex-wrap gap-1.5">
        {FACT_CATEGORIES.map((c) => (
          <button type="button" key={c.value} onClick={() => set("category", c.value)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition",
              v.category === c.value ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <Field label="Detail"><Textarea autoFocus value={v.content} onChange={(e) => set("content", e.target.value)} placeholder="Takes coffee with oat milk, no sugar" /></Field>
    </FormSheet>
  );
}

// ---------------------------------------------------------------- Interaction
export function InteractionForm({ open, onOpenChange, initial, personId }: FormProps<Interaction> & { personId?: string }) {
  const { create, update } = useData();
  const [saving, run] = useSaver();
  const [v, set] = useFormState(open, () => ({
    person_id: initial?.person_id ?? personId ?? "", date: initial?.date ?? todayISO(), kind: initial?.kind ?? "meeting",
    title: initial?.title ?? "", notes: initial?.notes ?? "", location: initial?.location ?? "",
    followUp: "", followUpDate: "",
  }));
  const save = () => run(async () => {
    if (!v.person_id) { toast.error("Pick a person"); return; }
    const row = { person_id: v.person_id, date: v.date || todayISO(), kind: v.kind, title: blank(v.title), notes: blank(v.notes), location: blank(v.location) };
    if (initial) await update("interactions", initial.id, row);
    else {
      await create("interactions", row);
      if (v.followUp.trim())
        await create("reminders", { person_id: v.person_id, title: v.followUp.trim(), due_date: v.followUpDate || todayISO(), repeat: "none", done: false });
    }
    toast.success("Logged");
    onOpenChange(false);
  });
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={initial ? "Edit meeting" : "Log a meeting"} onSubmit={save} saving={saving}>
      {!personId && !initial && <Field label="With"><PersonPicker value={v.person_id} onChange={(id) => set("person_id", id)} /></Field>}
      <div className="flex flex-wrap gap-1.5">
        {INTERACTION_KINDS.map((k) => (
          <button type="button" key={k.value} onClick={() => set("kind", k.value)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition",
              v.kind === k.value ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
            {k.emoji} {k.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Where"><Input value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="Café, Zoom…" /></Field>
      </div>
      <Field label="Title"><Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Coffee catch-up" /></Field>
      <Field label="What did you talk about?"><Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="New job, kids' news, plans, things to follow up on…" className="min-h-32" /></Field>
      {!initial && (
        <div className="grid gap-3 rounded-2xl border border-dashed p-3">
          <Field label="Follow-up (optional)"><Input value={v.followUp} onChange={(e) => set("followUp", e.target.value)} placeholder="Send the article I promised" /></Field>
          {v.followUp && <Field label="By"><Input type="date" value={v.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} /></Field>}
        </div>
      )}
    </FormSheet>
  );
}

// ---------------------------------------------------------------- Reminder
export function ReminderForm({ open, onOpenChange, initial, personId }: FormProps<Reminder> & { personId?: string }) {
  const { create, update } = useData();
  const [saving, run] = useSaver();
  const [v, set] = useFormState(open, () => ({
    person_id: initial?.person_id ?? personId ?? "", title: initial?.title ?? "", due_date: initial?.due_date ?? todayISO(),
    repeat: initial?.repeat ?? ("none" as Reminder["repeat"]),
  }));
  const save = () => run(async () => {
    if (!v.title.trim()) { toast.error("What should I remind you about?"); return; }
    const row = { person_id: v.person_id || null, title: v.title.trim(), due_date: v.due_date || todayISO(), repeat: v.repeat };
    if (initial) await update("reminders", initial.id, row); else await create("reminders", { ...row, done: false });
    onOpenChange(false);
  });
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={initial ? "Edit reminder" : "New reminder"} onSubmit={save} saving={saving}>
      <Field label="Remind me to"><Input autoFocus value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Call about the new job" /></Field>
      {!personId && <Field label="About (optional)"><PersonPicker value={v.person_id} onChange={(id) => set("person_id", id)} placeholder="Nobody in particular" /></Field>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
        <Field label="Repeat">
          <Select value={v.repeat} onChange={(e) => set("repeat", e.target.value as Reminder["repeat"])}>
            <option value="none">Never</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
      </div>
    </FormSheet>
  );
}

// ---------------------------------------------------------------- Tags
export function TagsForm({ open, onOpenChange, personId }: { open: boolean; onOpenChange(o: boolean): void; personId: string }) {
  const { db, create, remove } = useData();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("violet");
  const assigned = new Map(db.person_tags.filter((pt) => pt.person_id === personId).map((pt) => [pt.tag_id, pt.id]));

  const toggle = async (tagId: string) => {
    const link = assigned.get(tagId);
    try {
      if (link) await remove("person_tags", link);
      else await create("person_tags", { person_id: personId, tag_id: tagId });
    } catch {}
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const existing = db.tags.find((t) => t.name.toLowerCase() === n.toLowerCase());
    try {
      const tag = existing ?? (await create("tags", { name: n, color }));
      if (!assigned.has(tag.id)) await create("person_tags", { person_id: personId, tag_id: tag.id });
      setName("");
    } catch {}
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Tags" description="Group people: Family, Investors, Gym…"
      footer={<Button className="flex-1" onClick={() => onOpenChange(false)}>Done</Button>}>
      <div className="flex flex-wrap gap-2">
        {db.tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet. Create one below.</p>}
        {[...db.tags].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
          <button key={t.id} onClick={() => toggle(t.id)} className="transition active:scale-95">
            <Badge color={t.color} className={cn("px-3 py-1.5 text-sm", !assigned.has(t.id) && "opacity-45 grayscale")}>
              {assigned.has(t.id) && <Check className="size-3.5" />}{t.name}
            </Badge>
          </button>
        ))}
      </div>
      <form onSubmit={add} className="mt-5 grid gap-2 border-t pt-4">
        <span className="text-xs font-medium text-muted-foreground">New tag</span>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Neighbours" />
          <Button type="submit" size="icon" aria-label="Add tag"><Plus /></Button>
        </div>
        <div className="flex gap-2">
          {TAG_COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={c}
              className={cn("size-7 rounded-full ring-offset-2 ring-offset-background transition", TAG_DOTS[c], color === c && "ring-2 ring-foreground/60")} />
          ))}
        </div>
      </form>
    </Sheet>
  );
}
