import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const TAG_STYLES: Record<string, string> = {
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-violet-500/20",
  sky: "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/20",
  emerald: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-amber-500/25",
  rose: "bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-rose-500/20",
  slate: "bg-slate-500/12 text-slate-700 dark:text-slate-300 ring-slate-500/20",
};
export const TAG_DOTS: Record<string, string> = {
  violet: "bg-violet-500", sky: "bg-sky-500", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500", slate: "bg-slate-500",
};

export function Badge({ color = "slate", className, ...p }: HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TAG_STYLES[color] ?? TAG_STYLES.slate, className)}
      {...p}
    />
  );
}
