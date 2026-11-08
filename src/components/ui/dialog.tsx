import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, onOpenChange, title, description, children, footer, className }: {
  open: boolean; onOpenChange(o: boolean): void; title: string; description?: string;
  children: ReactNode; footer?: ReactNode; className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-up_.15s_ease-out]" />
        <D.Content
          aria-describedby={description ? undefined : undefined}
          onOpenAutoFocus={(e) => { if (window.matchMedia("(max-width: 767px)").matches) e.preventDefault(); }}
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col border bg-background shadow-2xl outline-none",
            "inset-x-0 bottom-0 rounded-t-3xl data-[state=open]:animate-[fade-up_.22s_ease-out]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[85vh] md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted md:hidden" />
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
            <div>
              <D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? <D.Description className="text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="-mr-1 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label={t("Close")}>
              <X className="size-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3">{children}</div>
          {footer && <div className="flex gap-2 border-t px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
