import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { localBackend, supabaseBackend, type Backend } from "@/lib/backend";
import { isSupabaseConfigured } from "@/lib/supabase";
import { TABLES, type Person, type TableName, type Tables } from "@/lib/types";
import { t } from "@/lib/i18n";

type Db = { [K in TableName]: Tables[K][] };
const empty = (): Db => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Db;

interface DataState {
  db: Db;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
  create<T extends TableName>(table: T, row: Omit<Tables[T], "id">): Promise<Tables[T]>;
  createMany<T extends TableName>(table: T, rows: (Omit<Tables[T], "id"> & { id?: string })[]): Promise<Tables[T][]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T]>;
  remove(table: TableName, id: string): Promise<void>;
  personById: Map<string, Person>;
  photoUrl(person?: Person | null): string | undefined;
  setPhoto(personId: string, blob: Blob | null): Promise<void>;
  uploadPhotoFor(personId: string, blob: Blob): Promise<string>;
}

const Ctx = createContext<DataState>(null!);
export const backend: Backend = isSupabaseConfigured ? supabaseBackend : localBackend;

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
  const msg = e instanceof Error ? e.message : (e as any)?.message ?? t("Something went wrong");
  toast.error(msg);
  throw e;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const loadUrls = useCallback(async (paths: string[]) => {
    const missing = paths.filter(Boolean);
    if (!missing.length) return;
    try {
      const got = await backend.photoUrls(missing);
      setUrls((u) => ({ ...u, ...got }));
    } catch { /* photos are optional; initials show instead */ }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lists = await Promise.all(TABLES.map((t) => backend.list(t)));
      const next = Object.fromEntries(TABLES.map((t, i) => [t, lists[i]])) as unknown as Db;
      setDb(next);
      loadUrls(next.people.map((p) => p.photo_path!).filter(Boolean));
    } catch (e: any) {
      setError(e?.message ?? t("Could not load your data"));
    } finally {
      setLoading(false);
    }
  }, [loadUrls]);

  useEffect(() => { reload(); }, [reload]);

  const create: DataState["create"] = useCallback(async (table, row) => {
    try {
      const saved = await backend.insert(table, row as any);
      setDb((d) => ({ ...d, [table]: [...d[table], saved] }));
      return saved;
    } catch (e) { fail(e); }
  }, []);

  const createMany: DataState["createMany"] = useCallback(async (table, rows) => {
    if (!rows.length) return [];
    try {
      const saved = await backend.insertMany(table, rows);
      setDb((d) => ({ ...d, [table]: [...d[table], ...saved] }));
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
      const photo = table === "people" ? db.people.find((p) => p.id === id)?.photo_path : null;
      await backend.remove(table, id);
      if (photo) backend.removePhoto(photo).catch(() => {});
      setDb((d) => {
        const next: any = { ...d, [table]: (d[table] as any[]).filter((r) => r.id !== id) };
        for (const c of CASCADE[table] ?? []) {
          next[c.table] = next[c.table].filter((r: any) => !c.fields.some((f) => r[f] === id));
        }
        return next;
      });
    } catch (e) { fail(e); }
  }, [db.people]);

  const uploadPhotoFor = useCallback(async (personId: string, blob: Blob) => {
    const path = await backend.uploadPhoto(personId, blob);
    await loadUrls([path]);
    return path;
  }, [loadUrls]);

  const setPhoto: DataState["setPhoto"] = useCallback(async (personId, blob) => {
    const old = db.people.find((p) => p.id === personId)?.photo_path;
    try {
      const path = blob ? await uploadPhotoFor(personId, blob) : null;
      await update("people", personId, { photo_path: path });
      if (old && old !== path) backend.removePhoto(old).catch(() => {});
    } catch (e) {
      if (!(e as any)?.__toasted) fail(e);
    }
  }, [db.people, update, uploadPhotoFor]);

  const personById = useMemo(() => new Map(db.people.map((p) => [p.id, p])), [db.people]);
  const photoUrl = useCallback((p?: Person | null) => (p?.photo_path ? urls[p.photo_path] : undefined), [urls]);

  return (
    <Ctx.Provider value={{ db, loading, error, reload, create, createMany, update, remove, personById, photoUrl, setPhoto, uploadPhotoFor }}>
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
