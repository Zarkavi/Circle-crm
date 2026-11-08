import { useState } from "react";
import { Download, LogOut, Monitor, Moon, RotateCcw, Smartphone, Sun, Tag, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/state/auth";
import { useData } from "@/state/data";
import { useConfirm } from "@/components/confirm";
import { PageHeader } from "@/components/shell";
import { Section } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme, type Theme } from "@/state/theme";
import { resetDemoData } from "@/lib/backend";
import { cn } from "@/lib/utils";
import { TABLES } from "@/lib/types";

export function SettingsPage() {
  const auth = useAuth();
  const { db, remove, create, reload } = useData();
  const confirm = useConfirm();
  const { theme, setTheme } = useTheme();
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
      for (const t of TABLES) {
        for (const row of (data[t] ?? []) as any[]) {
          const { id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = row;
          for (const k of ["person_id", "related_person_id", "tag_id"]) if (k in rest) rest[k] = fix(rest[k]);
          const saved = await create(t, rest);
          map.set(id, saved.id);
        }
      }
      toast.success("Backup imported");
    } catch (e: any) {
      toast.error("Import failed: " + (e?.message ?? "invalid file"));
    } finally {
      setImporting(false);
      reload();
    }
  };

  const themes: { v: Theme; icon: typeof Sun; label: string }[] = [
    { v: "light", icon: Sun, label: "Light" }, { v: "dark", icon: Moon, label: "Dark" }, { v: "system", icon: Monitor, label: "Auto" },
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <div className="mx-auto grid max-w-3xl gap-4 px-4 pt-2 md:px-6">
        <Section title="Account">
          <p className="text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{auth.email}</span>
            {auth.mode === "demo" && " (demo mode, data stays in this browser)"}</p>
          <Button variant="outline" className="mt-3" onClick={auth.signOut}><LogOut /> Sign out</Button>
        </Section>

        <Section title="Appearance">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {themes.map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => setTheme(v)}
                className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition", theme === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
                <Icon className="size-4" />{label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Tags" icon={<Tag />}>
          {db.tags.length === 0 ? <p className="text-sm text-muted-foreground">Create tags from a person's page.</p> : (
            <ul className="divide-y">
              {[...db.tags].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2"><Badge color={t.color}>{t.name}</Badge>
                    <span className="text-xs text-muted-foreground">{db.person_tags.filter((pt) => pt.tag_id === t.id).length} people</span></span>
                  <button aria-label={`Delete ${t.name}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                    onClick={async () => { if (await confirm({ title: `Delete tag “${t.name}”?`, text: "People keep their other details." })) remove("tags", t.id); }}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Install on your phone" icon={<Smartphone />}>
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div><p className="font-medium text-foreground">iPhone (Safari)</p>Tap <b>Share</b> → <b>Add to Home Screen</b>.</div>
            <div><p className="font-medium text-foreground">Android (Chrome)</p>Tap <b>⋮</b> → <b>Install app</b> (or <b>Add to Home screen</b>).</div>
          </div>
        </Section>

        <Section title="Backup">
          <p className="mb-3 text-sm text-muted-foreground">Download everything as a JSON file, or restore a backup.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}><Download /> Export</Button>
            <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted", importing && "pointer-events-none opacity-50")}>
              <Upload className="size-4" />{importing ? "Importing…" : "Import"}
              <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
            </label>
            {auth.mode === "demo" && (
              <Button variant="ghost" onClick={async () => {
                if (await confirm({ title: "Reset demo data?", text: "Everything you added in demo mode will be replaced with the sample data.", confirm: "Reset" })) { resetDemoData(); reload(); }
              }}><RotateCcw /> Reset demo</Button>
            )}
          </div>
        </Section>
        <p className="pb-4 text-center text-xs text-muted-foreground">Circle · personal CRM</p>
      </div>
    </>
  );
}
