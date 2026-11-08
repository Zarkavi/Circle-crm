import { useState } from "react";
import { cn, hueFor, initials } from "@/lib/utils";
import { useData } from "@/state/data";
import type { Person } from "@/lib/types";

export function Avatar({ name, size = 40, photo, className }: { name: string; size?: number; photo?: string; className?: string }) {
  const h = hueFor(name);
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (photo && !broken) {
    return <img src={photo} alt="" onError={() => setBroken(true)} style={style} className={cn("shrink-0 rounded-full bg-muted object-cover", className)} />;
  }
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold select-none", className)}
      style={{
        ...style, fontSize: size * 0.38,
        background: `linear-gradient(135deg, oklch(0.78 0.12 ${h}), oklch(0.62 0.17 ${h + 30}))`,
        color: "white", textShadow: "0 1px 1px rgba(0,0,0,.15)",
      }}
    >
      {initials(name)}
    </div>
  );
}

/** Avatar for someone in the CRM: shows their photo when they have one. */
export function PersonAvatar({ person, size, className }: { person: Person; size?: number; className?: string }) {
  const { photoUrl } = useData();
  return <Avatar name={person.full_name} photo={photoUrl(person)} size={size} className={className} />;
}
