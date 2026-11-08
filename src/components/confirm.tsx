import { createContext, useContext, useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

type Ask = (opts: { title: string; text?: string; confirm?: string }) => Promise<boolean>;
const Ctx = createContext<Ask>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ title: string; text?: string; confirm?: string; resolve(v: boolean): void } | null>(null);
  const ask: Ask = (o) => new Promise((resolve) => setState({ ...o, resolve }));
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Sheet open={!!state} onOpenChange={(o) => !o && close(false)} title={state?.title ?? ""}
        footer={<>
          <Button variant="secondary" className="flex-1" onClick={() => close(false)}>{t("Cancel")}</Button>
          <Button variant="destructive" className="flex-1" onClick={() => close(true)}>{state?.confirm ?? t("Delete")}</Button>
        </>}>
        <p className="text-sm text-muted-foreground">{state?.text}</p>
      </Sheet>
    </Ctx.Provider>
  );
}
export const useConfirm = () => useContext(Ctx);
