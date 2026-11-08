import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/avatar";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PersonRow({ person, sub, right, className }: { person: Person; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <Link to={`/people/${person.id}`}
      className={cn("flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-muted active:bg-muted", className)}>
      <PersonAvatar person={person} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-sm font-medium">
          {person.full_name}
          {person.favorite && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
        </div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </Link>
  );
}
