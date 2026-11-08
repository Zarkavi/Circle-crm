import { useMemo, useRef, useState } from "react";
import { Check, Contact, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { useData } from "@/state/data";
import { contactPickerSupported, parseVCards, pickContacts, type ImportedContact } from "@/lib/vcard";
import { base64ToBlob, toAvatarJpeg } from "@/lib/image";
import { t } from "@/lib/i18n";
import { cn, uid } from "@/lib/utils";

type Row = ImportedContact & { key: number; duplicate: boolean };

const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "").slice(-9);
const norm = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, " ").trim();

export function ImportSheet({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const { db, createMany, update, uploadPhotoFor } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const reset = () => { setRows(null); setSelected(new Set()); setProgress(null); };
  const close = (o: boolean) => { if (!progress) { onOpenChange(o); if (!o) setTimeout(reset, 200); } };

  const load = (contacts: ImportedContact[]) => {
    if (!contacts.length) { toast.error(t("No contacts found in that file")); return; }
    const names = new Set(db.people.map((p) => norm(p.full_name)));
    const phones = new Set(db.people.map((p) => digits(p.phone)).filter((d) => d.length >= 7));
    const list = contacts
      .map((c, i) => ({ ...c, key: i, duplicate: names.has(norm(c.full_name)) || (digits(c.phone).length >= 7 && phones.has(digits(c.phone))) }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    setRows(list);
    setSelected(new Set(list.filter((r) => !r.duplicate).map((r) => r.key)));
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try { load(parseVCards(await f.text())); } catch { toast.error(t("Couldn't read that file")); }
  };

  const onPick = async () => {
    try { load(await pickContacts()); } catch { /* user closed the picker */ }
  };

  const chosen = useMemo(() => rows?.filter((r) => selected.has(r.key)) ?? [], [rows, selected]);

  const run = async () => {
    const withPhoto = chosen.filter((c) => c.photo);
    const total = chosen.length + withPhoto.length;
    setProgress({ done: 0, total });
    try {
      const ids = new Map(chosen.map((c) => [c.key, uid()]));
      await createMany("people", chosen.map((c) => ({
        id: ids.get(c.key), full_name: c.full_name, nickname: c.nickname ?? null, phone: c.phone ?? null, email: c.email ?? null,
        birthday: c.birthday ?? null, city: c.city ?? null, notes: c.notes ?? null, favorite: false,
      })));
      await createMany("jobs", chosen.filter((c) => c.company).map((c) => ({
        person_id: ids.get(c.key)!, company: c.company!, title: c.title ?? null, is_current: true,
      })));
      let done = chosen.length;
      setProgress({ done, total });
      for (const c of withPhoto) {
        try {
          const blob = await toAvatarJpeg(base64ToBlob(c.photo!.base64, c.photo!.type));
          const path = await uploadPhotoFor(ids.get(c.key)!, blob);
          await update("people", ids.get(c.key)!, { photo_path: path });
        } catch { /* skip photos that fail; the person is already saved */ }
        setProgress({ done: ++done, total });
      }
      toast.success(t("{n} people imported", { n: chosen.length }));
      setProgress(null);
      onOpenChange(false);
      setTimeout(reset, 200);
    } catch {
      setProgress(null);
    }
  };

  const toggle = (k: number) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <Sheet open={open} onOpenChange={close} title={t("Import from contacts")}
      description={rows ? t("{n} contacts found", { n: rows.length }) : undefined}
      footer={rows ? (
        <>
          <Button variant="secondary" className="flex-1" onClick={reset} disabled={!!progress}>{t("Back")}</Button>
          <Button className="flex-1" onClick={run} disabled={!chosen.length || !!progress}>
            {progress ? `${progress.done} / ${progress.total}` : t("Import {n}", { n: chosen.length })}
          </Button>
        </>
      ) : undefined}>
      {!rows ? (
        <div className="grid gap-3 pb-3">
          {contactPickerSupported() && (
            <button onClick={onPick} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition hover:bg-muted">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Contact className="size-5" /></span>
              <span><span className="block text-sm font-medium">{t("Pick from my contacts")}</span>
                <span className="text-xs text-muted-foreground">{t("Name, phone and email")}</span></span>
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition hover:bg-muted">
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><FileUp className="size-5" /></span>
            <span><span className="block text-sm font-medium">{t("Choose a contacts file (.vcf)")}</span>
              <span className="text-xs text-muted-foreground">{t("Also brings photos, birthdays and companies")}</span></span>
          </button>
          <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden"
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />

          <div className="mt-2 grid gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
            <p className="font-medium">{t("How to get the file")}</p>
            <div>
              <p className="font-medium text-foreground/90">iPhone</p>
              <p className="text-muted-foreground">{t("Contacts app → Lists → press and hold “All Contacts” → Export. Save it to Files, then choose it here.")}</p>
            </div>
            <div>
              <p className="font-medium text-foreground/90">Android</p>
              <p className="text-muted-foreground">{t("Contacts app → Fix & manage → Export to file. Then choose the .vcf file here.")}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="pb-2">
          <div className="mb-2 flex justify-between text-xs">
            <button className="text-primary" onClick={() => setSelected(new Set(rows.map((r) => r.key)))}>{t("Select all")}</button>
            <button className="text-muted-foreground" onClick={() => setSelected(new Set())}>{t("Select none")}</button>
          </div>
          <ul className="-mx-2 grid">
            {rows.map((r) => {
              const on = selected.has(r.key);
              return (
                <li key={r.key}>
                  <button onClick={() => toggle(r.key)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted">
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border-2 transition", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <Avatar name={r.full_name} size={34} photo={r.photo ? `data:${r.photo.type};base64,${r.photo.base64}` : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[r.company, r.phone ?? r.email].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    {r.duplicate && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t("Already added")}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
