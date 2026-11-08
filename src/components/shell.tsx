import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, Home, Plus, Search, Settings, Users } from "lucide-react";
import { useAuth } from "@/state/auth";
import { useData } from "@/state/data";
import { useQuickAdd } from "@/components/quick-add";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/dates";

const NAV = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/people", label: "People", icon: Users },
  { to: "/search", label: "Search", icon: Search },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/30">
        <span className="size-3 rounded-full border-2 border-white" />
      </span>
      Circle
    </div>
  );
}

export function Shell() {
  const { mode } = useAuth();
  const { db, loading, error, reload } = useData();
  const qa = useQuickAdd();
  const loc = useLocation();
  const due = db.reminders.filter((r) => !r.done && r.due_date <= todayISO()).length;

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card/50 p-4 md:flex">
        <Logo className="px-2 pb-6 pt-1 text-lg" />
        <Button onClick={qa.openMenu} className="mb-4 w-full"><Plus /> Add</Button>
        <nav className="grid gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                isActive && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground")}>
              <Icon className="size-4" />{label}
              {to === "/reminders" && due > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{due}</span>}
            </NavLink>
          ))}
        </nav>
        {mode === "demo" && (
          <div className="mt-auto rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            <b className="text-foreground">Demo mode.</b> Data is stored only in this browser. Add Supabase keys to sync and sign in.
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 overflow-x-clip pb-28 md:pb-10">
        {mode === "demo" && (
          <div className="pt-safe bg-accent text-center text-[11px] font-medium text-accent-foreground md:hidden">
            <div className="py-1">Demo mode · data stays on this device</div>
          </div>
        )}
        {error ? (
          <div className="mx-auto max-w-md p-8 text-center">
            <p className="font-medium">Couldn't load your data</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={reload}>Try again</Button>
          </div>
        ) : loading ? (
          <div className="mx-auto grid max-w-3xl gap-3 p-6">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : (
          <div key={loc.pathname} className="animate-in"><Outlet /></div>
        )}
      </main>

      {/* Mobile tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          {NAV.slice(0, 2).map((n) => <Tab key={n.to} {...n} />)}
          <div className="grid place-items-center">
            <button onClick={qa.openMenu} aria-label="Add"
              className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 transition active:scale-90">
              <Plus className="size-6" />
            </button>
          </div>
          {NAV.slice(2, 4).map((n) => <Tab key={n.to} {...n} badge={n.to === "/reminders" ? due : 0} />)}
        </div>
      </nav>
    </div>
  );
}

function Tab({ to, label, icon: Icon, end, badge = 0 }: { to: string; label: string; icon: typeof Home; end?: boolean; badge?: number }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cn("relative flex flex-col items-center gap-0.5 text-[10px] font-medium text-muted-foreground transition", isActive && "text-primary")}>
      <Icon className="size-[22px]" strokeWidth={1.8} />
      {label}
      {badge > 0 && <span className="absolute -top-1 right-[calc(50%-18px)] min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">{badge}</span>}
    </NavLink>
  );
}

/** Page header with a settings shortcut on phones (settings isn't in the tab bar). */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="pt-safe mx-auto flex max-w-3xl items-end justify-between gap-3 px-4 pb-2 pt-6 md:px-6 md:pt-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1">
        {action}
        <NavLink to="/settings" className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted md:hidden" aria-label="Settings">
          <Settings className="size-5" />
        </NavLink>
      </div>
    </header>
  );
}
