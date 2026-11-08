import type { TableName, Tables } from "./types";
import { supabase } from "./supabase";
import { uid } from "./utils";
import { seedData } from "./seed";

export interface Backend {
  list<T extends TableName>(table: T): Promise<Tables[T][]>;
  insert<T extends TableName>(table: T, row: Omit<Tables[T], "id"> & { id?: string }): Promise<Tables[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T]>;
  remove(table: TableName, id: string): Promise<void>;
  insertMany<T extends TableName>(table: T, rows: (Omit<Tables[T], "id"> & { id?: string })[]): Promise<Tables[T][]>;
  /** Stores a profile photo and returns its storage path. */
  uploadPhoto(personId: string, blob: Blob): Promise<string>;
  removePhoto(path: string): Promise<void>;
  /** Turns storage paths into URLs the browser can show. */
  photoUrls(paths: string[]): Promise<Record<string, string>>;
}

/** Talks to Supabase. Row Level Security limits every query to the signed-in user. */
export const supabaseBackend: Backend = {
  async list(table) {
    const pageSize = 1000;
    const rows: any[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase!.from(table).select("*").range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < pageSize) break;
    }
    return rows;
  },
  async insert(table, row) {
    const { data, error } = await supabase!.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async update(table, id, patch) {
    const { id: _ignored, user_id: _u, created_at: _c, updated_at: _up, ...rest } = patch as any;
    const { data, error } = await supabase!.from(table).update(rest).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(table, id) {
    const { error } = await supabase!.from(table).delete().eq("id", id);
    if (error) throw error;
  },
  async insertMany(table, rows) {
    const out: any[] = [];
    for (let i = 0; i < rows.length; i += 200) {
      const { data, error } = await supabase!.from(table).insert(rows.slice(i, i + 200)).select();
      if (error) throw error;
      out.push(...data);
    }
    return out;
  },
  async uploadPhoto(personId, blob) {
    const { data: { session } } = await supabase!.auth.getSession();
    if (!session) throw new Error("Not signed in");
    const path = `${session.user.id}/${personId}-${Date.now()}.jpg`;
    const { error } = await supabase!.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    return path;
  },
  async removePhoto(path) {
    await supabase!.storage.from("avatars").remove([path]);
  },
  async photoUrls(paths) {
    if (!paths.length) return {};
    const out: Record<string, string> = {};
    for (let i = 0; i < paths.length; i += 500) {
      const { data, error } = await supabase!.storage.from("avatars").createSignedUrls(paths.slice(i, i + 500), 60 * 60 * 24 * 7);
      if (error) throw error;
      for (const d of data) if (d.signedUrl && d.path) out[d.path] = d.signedUrl;
    }
    return out;
  },
};

/** Demo mode: everything lives in this browser's localStorage. */
const KEY = "circle-demo-db-v1";
type Db = { [K in TableName]: Tables[K][] };

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const db = seedData();
  save(db);
  return db;
}
function save(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {}
}

// Mirrors the "on delete cascade" rules in supabase/schema.sql
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

export const localBackend: Backend = {
  async list(table) {
    return load()[table] as any;
  },
  async insert(table, row) {
    const db = load();
    const now = new Date().toISOString();
    const full = { ...row, id: row.id ?? uid(), created_at: now, updated_at: now } as any;
    (db[table] as any[]).push(full);
    save(db);
    return full;
  },
  async update(table, id, patch) {
    const db = load();
    const list = db[table] as any[];
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) throw new Error("Not found");
    list[i] = { ...list[i], ...patch, id, updated_at: new Date().toISOString() };
    save(db);
    return list[i];
  },
  async remove(table, id) {
    const db = load();
    (db as any)[table] = (db[table] as any[]).filter((r) => r.id !== id);
    for (const c of CASCADE[table] ?? []) {
      (db as any)[c.table] = (db[c.table] as any[]).filter((r) => !c.fields.some((f) => r[f] === id));
    }
    save(db);
  },
  async insertMany(table, rows) {
    const out = [];
    for (const r of rows) out.push(await localBackend.insert(table, r));
    return out;
  },
  // Demo mode keeps the (small, resized) photo inline as a data URL.
  async uploadPhoto(_personId, blob) {
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  },
  async removePhoto() {},
  async photoUrls(paths) {
    return Object.fromEntries(paths.map((p) => [p, p]));
  },
};

export function resetDemoData() {
  localStorage.removeItem(KEY);
}
