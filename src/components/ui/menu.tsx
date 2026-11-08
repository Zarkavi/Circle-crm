import * as M from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Menu({ trigger, items, align = "end" }: {
  trigger: ReactNode;
  items: { label: string; icon?: ReactNode; onSelect(): void; danger?: boolean }[];
  align?: "start" | "end";
}) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content align={align} sideOffset={6} className="z-50 min-w-44 rounded-xl border bg-card p-1 shadow-xl animate-in">
          {items.map((it) => (
            <M.Item key={it.label} onSelect={it.onSelect}
              className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-muted [&_svg]:size-4",
                it.danger && "text-destructive")}>
              {it.icon}{it.label}
            </M.Item>
          ))}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
