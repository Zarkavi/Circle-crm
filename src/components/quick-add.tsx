import { createContext, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Contact, MessageSquarePlus, UserPlus } from "lucide-react";
import { Sheet } from "@/components/ui/dialog";
import { InteractionForm, PersonForm, ReminderForm } from "@/components/forms";
import { ImportSheet } from "@/components/import-contacts";
import { t } from "@/lib/i18n";

interface QuickAdd { openMenu(): void; newPerson(): void; logMeeting(personId?: string): void; newReminder(): void; importContacts(): void }
const Ctx = createContext<QuickAdd>(null!);

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const [person, setPerson] = useState(false);
  const [meeting, setMeeting] = useState<{ personId?: string } | null>(null);
  const [reminder, setReminder] = useState(false);
  const [importing, setImporting] = useState(false);

  const api: QuickAdd = {
    openMenu: () => setMenu(true),
    newPerson: () => setPerson(true),
    logMeeting: (personId) => setMeeting({ personId }),
    newReminder: () => setReminder(true),
    importContacts: () => setImporting(true),
  };
  const pick = (fn: () => void) => { setMenu(false); setTimeout(fn, 120); };

  const actions = [
    { icon: <UserPlus />, label: t("New person"), text: t("Add someone you met"), run: api.newPerson },
    { icon: <MessageSquarePlus />, label: t("Log a meeting"), text: t("Coffee, call, dinner, message"), run: () => api.logMeeting() },
    { icon: <Bell />, label: t("Reminder"), text: t("Follow up, call back, send a gift"), run: api.newReminder },
    { icon: <Contact />, label: t("Import from contacts"), text: t("Bring people in from your phone"), run: api.importContacts },
  ];

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet open={menu} onOpenChange={setMenu} title={t("Add")}>
        <div className="grid gap-2 pb-3">
          {actions.map((a) => (
            <button key={a.label} onClick={() => pick(a.run)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition hover:bg-muted active:scale-[.99]">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground [&_svg]:size-5">{a.icon}</span>
              <span><span className="block text-sm font-medium">{a.label}</span><span className="text-xs text-muted-foreground">{a.text}</span></span>
            </button>
          ))}
        </div>
      </Sheet>
      <PersonForm open={person} onOpenChange={setPerson} onSaved={(p) => nav(`/people/${p.id}`)} />
      <InteractionForm open={!!meeting} onOpenChange={(o) => !o && setMeeting(null)} personId={meeting?.personId} />
      <ReminderForm open={reminder} onOpenChange={setReminder} />
      <ImportSheet open={importing} onOpenChange={setImporting} />
    </Ctx.Provider>
  );
}
export const useQuickAdd = () => useContext(Ctx);
