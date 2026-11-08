import { cn, hueFor, initials } from "@/lib/utils";

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const h = hueFor(name);
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold select-none", className)}
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `linear-gradient(135deg, oklch(0.78 0.12 ${h}), oklch(0.62 0.17 ${h + 30}))`,
        color: "white", textShadow: "0 1px 1px rgba(0,0,0,.15)",
      }}
    >
      {initials(name)}
    </div>
  );
}
