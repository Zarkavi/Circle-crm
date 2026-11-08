import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { localBackend, supabaseBackend, type Backend } from "@/lib/backend";
import { isSupabaseConfigured } from "@/lib/supabase";
import { TABLES, type Person, type TableName, type Tables } from "@/lib/types";

type Db = { [K in TableName]: Tables[K][] };
const empty = (): Db => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Db;

interface DataState {
  db: Db;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
  create<T extends TableName>(table: T, row: Omit<Tables[T], "id">): Promise<Tables[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T]>;
  remove(table: TableName, id: string): Promise<void>;
  personById: Map<string, Person>;
}

const Ctx = createContext<DataState>(null!);
const backend: Backend = isSupabaseConfigured ? supabaseBackend : localBackend;

const CASCADE: Partial<Record<TableName, { table: TableName; fields: string[] }[]>> = {
  people: [
    { table: "jobs", fields: ["person_id"] },
    { table: "relationships", fields: ["person_id", "related_person_id"] },
    { table: "facts", fields: ["person_id"] },
    { table: "interactions", fields: ["person_id"] },
    { table: "reminders", fields: ["person_id"] },
    { table: "person_tags", fields: ["person_id"] },
  ],
  tags: [{ table: "person_tags", fields: ["tag_id"] }],
};

function fail(e: unknown): never {
  const msg = e instanceof Error ? e.message : (e as any)?.message ?? "Something went wrong";
  toast.error(msg);
  throw e;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lists = await Promise.all(TABLES.map((t) => backend.list(t)));
      setDb(Object.fromEntries(TABLES.map((t, i) => [t, lists[i]])) as unknown as Db);
    } catch (e: any) {
      setError(e?.message ?? "Could not load your data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create: DataState["create"] = useCallback(async (table, row) => {
    try {
      const saved = await backend.insert(table, row as any);
      setDb((d) => ({ ...d, [table]: [...d[table], saved] }));
      return saved;
    } catch (e) { fail(e); }
  }, []);

  const update: DataState["update"] = useCallback(async (table, id, patch) => {
    try {
      const saved = await backend.update(table, id, patch);
      setDb((d) => ({ ...d, [table]: (d[table] as any[]).map((r) => (r.id === id ? saved : r)) }));
      return saved;
    } catch (e) { fail(e); }
  }, []);

  const remove: DataState["remove"] = useCallback(async (table, id) => {
    try {
      await backend.remove(table, id);
      setDb((d) => {
        const next: any = { ...d, [table]: (d[table] as any[]).filter((r) => r.id !== id) };
        for (const c of CASCADE[table] ?? []) {
          next[c.table] = next[c.table].filter((r: any) => !c.fields.some((f) => r[f] === id));
        }
        return next;
      });
    } catch (e) { fail(e); }
  }, []);

  const personById = useMemo(() => new Map(db.people.map((p) => [p.id, p])), [db.people]);

  return (
    <Ctx.Provider value={{ db, loading, error, reload, create, update, remove, personById }}>
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
