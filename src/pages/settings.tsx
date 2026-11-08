import { useEffect, useState } from "react";
import { BellRing, Contact, Download, Globe, LogOut, Monitor, Moon, RotateCcw, Smartphone, Sun, Tag, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/state/auth";
import { useData } from "@/state/data";
import { useConfirm } from "@/components/confirm";
import { useQuickAdd } from "@/components/quick-add";
import { PageHeader } from "@/components/shell";
import { Section } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { useTheme, type Theme } from "@/state/theme";
import { useLang } from "@/state/lang";
import { resetDemoData } from "@/lib/backend";
import { currentNotifyHour, disablePush, enablePush, pushState, sendTestPush, type PushState } from "@/lib/push";
import { t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TABLES } from "@/lib/types";

function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange(v: T): void; options: { v: T; label: string; icon?: typeof Sun }[];
}) {
  return (
    <div className={cn("grid gap-1 rounded-xl bg-muted p-1", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {options.map(({ v, icon: Icon, label }) => (
        <button key={v} onClick={() => onChange(v)}
          className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition", value === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
          {Icon && <Icon className="size-4" />}{label}
        </button>
      ))}
    </div>
  );
}

function Notifications() {
  const { mode } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [hour, setHour] = useState(9);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "supabase") return;
    pushState().then(setState).catch(() => setState("unsupported"));
    currentNotifyHour().then((h) => h !== null && setHour(h)).catch(() => {});
  }, [mode]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      setState(await pushState());
    } catch (e: any) {
      toast.error(e?.message === "permission" ? t("Notifications are blocked. Allow them in your phone's settings.") : e?.message ?? t("Something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  const changeHour = (h: number) => {
    setHour(h);
    if (state === "on") act(() => enablePush(h), t("Saved"));
  };

  let body;
  if (mode !== "supabase") body = <p className="text-sm text-muted-foreground">{t("Notifications need a signed-in account (not available in demo mode).")}</p>;
  else if (state === null) body = <div className="h-10 animate-pulse rounded-xl bg-muted" />;
  else if (state === "needs-install") body = <p className="text-sm text-muted-foreground">{t("On iPhone, first add Circle to your Home Screen (Share → Add to Home Screen), then open it from the icon and come back here.")}</p>;
  else if (state === "unsupported") body = <p className="text-sm text-muted-foreground">{t("This browser doesn't support notifications.")}</p>;
  else if (state === "denied") body = <p className="text-sm text-muted-foreground">{t("Notifications are blocked. Allow them in your phone's settings.")}</p>;
  else body = (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("One message a day with birthdays (today and tomorrow, kids included) and reminders that are due.")}</p>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>{t("Send at")}</span>
        <Select className="w-28" value={hour} onChange={(e) => changeHour(Number(e.target.value))} disabled={busy}>
          {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
        </Select>
      </label>
      <div className="flex flex-wrap gap-2">
        {state === "on" ? (
          <>
            <Button variant="outline" disabled={busy} onClick={() => act(async () => {
              const r = await sendTestPush();
              if (!r.sent) throw new Error(t("No device received it. Try turning notifications off and on again."));
            }, t("Test notification sent"))}>{t("Send test notification")}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => act(disablePush, t("Notifications turned off"))}>{t("Turn off")}</Button>
          </>
        ) : (
          <Button disabled={busy} onClick={() => act(() => enablePush(hour), t("Notifications turned on"))}><BellRing /> {t("Turn on notifications")}</Button>
        )}
      </div>
      {state === "on" && <p className="text-xs text-muted-foreground">{t("On for this device. Turn it on separately on each phone or computer you use.")}</p>}
    </div>
  );

  return <Section title={t("Notifications")} icon={<BellRing />}>{body}</Section>;
}

export function SettingsPage() {
  const auth = useAuth();
  const { db, remove, create, reload } = useData();
  const confirm = useConfirm();
  const qa = useQuickAdd();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLang();
  const [importing, setImporting] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), version: 1, ...db }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `circle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Restores a backup by re-creating records with fresh ids, keeping the links between them.
  const importData = async (file: File) => {
    setImporting(true);
    try {
      const data = JSON.parse(await file.text());
      const map = new Map<string, string>();
      const fix = (v: any) => (typeof v === "string" && map.has(v) ? map.get(v) : v);
      for (const table of TABLES) {
        for (const row of (data[table] ?? []) as any[]) {
          const { id, user_id: _u, created_at: _c, updated_at: _up, photo_path: _p, ...rest } = row;
          for (const k of ["person_id", "related_person_id", "tag_id"]) if (k in rest) rest[k] = fix(rest[k]);
          const saved = await create(table, rest);
          map.set(id, saved.id);
        }
      }
      toast.success(t("Backup imported"));
    } catch (e: any) {
      toast.error(t("Import failed: {msg}", { msg: e?.message ?? "invalid file" }));
    } finally {
      setImporting(false);
      reload();
    }
  };

  const themes: { v: Theme; icon: typeof Sun; label: string }[] = [
    { v: "light", icon: Sun, label: t("Light") }, { v: "dark", icon: Moon, label: t("Dark") }, { v: "system", icon: Monitor, label: t("Auto") },
  ];

  return (
    <>
      <PageHeader title={t("Settings")} />
      <div className="mx-auto grid max-w-3xl gap-4 px-4 pt-2 md:px-6">
        <Section title={t("Account")}>
          <p className="text-sm text-muted-foreground">{t("Signed in as")} <span className="font-medium text-foreground">{auth.email}</span>
            {auth.mode === "demo" && ` (${t("demo mode, data stays in this browser")})`}</p>
          <Button variant="outline" className="mt-3" onClick={auth.signOut}><LogOut /> {t("Sign out")}</Button>
        </Section>

        <Section title={t("Language")} icon={<Globe />}>
          <Segmented<Lang> value={lang} onChange={setLang} options={[{ v: "tr", label: "Türkçe" }, { v: "en", label: "English" }]} />
        </Section>

        <Section title={t("Appearance")}>
          <Segmented<Theme> value={theme} onChange={setTheme} options={themes} />
        </Section>

        <Notifications />

        <Section title={t("Import from contacts")} icon={<Contact />}>
          <p className="mb-3 text-sm text-muted-foreground">{t("Bring people in from your phone's contacts, with photos and birthdays.")}</p>
          <Button variant="outline" onClick={qa.importContacts}><Contact /> {t("Import contacts")}</Button>
        </Section>

        <Section title={t("Tags")} icon={<Tag />}>
          {db.tags.length === 0 ? <p className="text-sm text-muted-foreground">{t("Create tags from a person's page.")}</p> : (
            <ul className="divide-y">
              {[...db.tags].sort((a, b) => a.name.localeCompare(b.name)).map((tag) => (
                <li key={tag.id} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2"><Badge color={tag.color}>{tag.name}</Badge>
                    <span className="text-xs text-muted-foreground">{t("{n} people", { n: db.person_tags.filter((pt) => pt.tag_id === tag.id).length })}</span></span>
                  <button aria-label={t("Delete")} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                    onClick={async () => { if (await confirm({ title: t("Delete tag “{name}”?", { name: tag.name }), text: t("People keep their other details.") })) remove("tags", tag.id); }}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("Install on your phone")} icon={<Smartphone />}>
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div><p className="font-medium text-foreground">iPhone (Safari)</p>{t("Tap Share → Add to Home Screen.")}</div>
            <div><p className="font-medium text-foreground">Android (Chrome)</p>{t("Tap ⋮ → Install app (or Add to Home screen).")}</div>
          </div>
        </Section>

        <Section title={t("Backup")}>
          <p className="mb-3 text-sm text-muted-foreground">{t("Download everything as a JSON file, or restore a backup.")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}><Download /> {t("Export")}</Button>
            <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted", importing && "pointer-events-none opacity-50")}>
              <Upload className="size-4" />{importing ? t("Importing…") : t("Import")}
              <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
            </label>
            {auth.mode === "demo" && (
              <Button variant="ghost" onClick={async () => {
                if (await confirm({ title: t("Reset demo data?"), text: t("Everything you added in demo mode will be replaced with the sample data."), confirm: t("Reset") })) { resetDemoData(); reload(); }
              }}><RotateCcw /> {t("Reset demo")}</Button>
            )}
          </div>
        </Section>
        <p className="pb-4 text-center text-xs text-muted-foreground">Circle · {t("personal CRM")}</p>
      </div>
    </>
  );
}
