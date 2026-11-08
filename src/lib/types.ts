export interface Base {
  id: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Person extends Base {
  full_name: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  birthday?: string | null;
  city?: string | null;
  how_we_met?: string | null;
  notes?: string | null;
  keep_in_touch_days?: number | null;
  favorite: boolean;
  photo_path?: string | null;
}

export interface Job extends Base {
  person_id: string;
  company: string;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current: boolean;
  notes?: string | null;
}

export interface Relationship extends Base {
  person_id: string;
  related_person_id?: string | null;
  name?: string | null;
  relation: string;
  birthday?: string | null;
  notes?: string | null;
}

export interface Fact extends Base {
  person_id: string;
  category: string;
  content: string;
}

export interface Interaction extends Base {
  person_id: string;
  date: string;
  kind: string;
  title?: string | null;
  notes?: string | null;
  location?: string | null;
}

export interface Reminder extends Base {
  person_id?: string | null;
  title: string;
  due_date: string;
  repeat: "none" | "monthly" | "yearly";
  done: boolean;
}

export interface Tag extends Base {
  name: string;
  color: string;
}

export interface PersonTag extends Base {
  person_id: string;
  tag_id: string;
}

export interface Tables {
  people: Person;
  jobs: Job;
  relationships: Relationship;
  facts: Fact;
  interactions: Interaction;
  reminders: Reminder;
  tags: Tag;
  person_tags: PersonTag;
}
export type TableName = keyof Tables;
export const TABLES: TableName[] = [
  "people", "jobs", "relationships", "facts", "interactions", "reminders", "tags", "person_tags",
];
