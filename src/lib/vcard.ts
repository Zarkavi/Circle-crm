/** Contact parsed from a .vcf file or the Android contact picker. */
export interface ImportedContact {
  full_name: string;
  nickname?: string;
  phone?: string;
  email?: string;
  birthday?: string;     // 'YYYY-MM-DD' or '--MM-DD'
  company?: string;
  title?: string;
  city?: string;
  notes?: string;
  photo?: { base64: string; type: string };
}

function decodeQP(s: string, charset = "utf-8") {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(s.charCodeAt(i) & 0xff);
  }
  try { return new TextDecoder(charset).decode(new Uint8Array(bytes)); } catch { return new TextDecoder().decode(new Uint8Array(bytes)); }
}

const unescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

/** Splits on unescaped `;` (structured fields like N and ADR). */
const parts = (s: string) => s.split(/(?<!\\);/).map((p) => unescape(p).trim());

export function normalizeBirthday(raw?: string): string | undefined {
  if (!raw) return;
  const v = raw.trim().split("T")[0];
  let m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(v);
  if (m) {
    // iOS uses 1604 when the year is unknown
    const noYear = m[1] === "1604" || m[1] === "0000";
    return noYear ? `--${m[2]}-${m[3]}` : `${m[1]}-${m[2]}-${m[3]}`;
  }
  m = /^--(\d{2})-?(\d{2})$/.exec(v);
  if (m) return `--${m[1]}-${m[2]}`;
}

interface Prop { name: string; params: Record<string, string>; types: string[]; value: string }

function parseLine(line: string): Prop | null {
  // a ':' inside quoted params must not split the line
  let inQuote = false, idx = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuote = !inQuote;
    else if (line[i] === ":" && !inQuote) { idx = i; break; }
  }
  if (idx < 0) return null;
  const [rawName, ...rawParams] = line.slice(0, idx).split(";");
  const name = rawName.replace(/^[^.]+\./, "").toUpperCase(); // drop "item1." group prefix
  const params: Record<string, string> = {};
  const types: string[] = [];
  for (const p of rawParams) {
    const [k, v] = p.includes("=") ? p.split("=") : ["TYPE", p];
    const key = k.toUpperCase(), val = (v ?? "").replace(/"/g, "");
    if (key === "TYPE") types.push(...val.toUpperCase().split(","));
    else params[key] = val;
  }
  let value = line.slice(idx + 1);
  if ((params.ENCODING ?? "").toUpperCase() === "QUOTED-PRINTABLE") value = decodeQP(value, params.CHARSET || "utf-8");
  return { name, params, types, value };
}

export function parseVCards(text: string): ImportedContact[] {
  // join soft line breaks: folded lines (start with space/tab) and quoted-printable lines ending with '='
  const raw = text.replace(/\r\n?/g, "\n").split("\n");
  const lines: string[] = [];
  for (const l of raw) {
    if (/^[ \t]/.test(l) && lines.length) lines[lines.length - 1] += l.slice(1);
    else if (lines.length && /QUOTED-PRINTABLE/i.test(lines[lines.length - 1].split(":")[0]) && lines[lines.length - 1].endsWith("="))
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + l;
    else lines.push(l);
  }

  const out: ImportedContact[] = [];
  let props: Prop[] | null = null;
  for (const line of lines) {
    const u = line.trim().toUpperCase();
    if (u === "BEGIN:VCARD") { props = []; continue; }
    if (u === "END:VCARD") {
      if (props) { const c = toContact(props); if (c) out.push(c); }
      props = null;
      continue;
    }
    if (props) { const p = parseLine(line); if (p) props.push(p); }
  }
  return out;
}

function toContact(props: Prop[]): ImportedContact | null {
  const get = (n: string) => props.filter((p) => p.name === n);
  const first = (n: string) => get(n)[0];

  let full_name = unescape(first("FN")?.value ?? "").trim();
  const n = first("N");
  if (!full_name && n) {
    const [family, given, middle] = parts(n.value);
    full_name = [given, middle, family].filter(Boolean).join(" ");
  }
  const org = first("ORG") ? parts(first("ORG")!.value)[0] : undefined;
  if (!full_name) full_name = org ?? "";
  if (!full_name) return null;

  const tels = get("TEL");
  const tel = tels.find((t) => t.types.includes("CELL") || t.types.includes("PREF")) ?? tels[0];
  const adr = first("ADR");

  let photo: ImportedContact["photo"];
  const ph = first("PHOTO");
  if (ph) {
    const dataUrl = /^data:(image\/[a-z]+);base64,(.*)$/i.exec(ph.value);
    if (dataUrl) photo = { type: dataUrl[1], base64: dataUrl[2] };
    else if (/^(b|base64)$/i.test(ph.params.ENCODING ?? "")) {
      const t = (ph.types.find((x) => x !== "") ?? "JPEG").toLowerCase();
      photo = { type: `image/${t === "jpg" ? "jpeg" : t}`, base64: ph.value };
    }
  }

  return {
    full_name,
    nickname: unescape(first("NICKNAME")?.value ?? "").split(",")[0].trim() || undefined,
    phone: tel?.value.replace(/^tel:/i, "").trim() || undefined,
    email: first("EMAIL")?.value.trim() || undefined,
    birthday: normalizeBirthday(first("BDAY")?.value),
    company: org || undefined,
    title: unescape(first("TITLE")?.value ?? "").trim() || undefined,
    city: adr ? parts(adr.value)[3] || undefined : undefined,
    notes: unescape(first("NOTE")?.value ?? "").trim() || undefined,
    photo,
  };
}

/** Android Chrome can open the phone's contact list directly. */
export const contactPickerSupported = () => "contacts" in navigator && "ContactsManager" in window;

export async function pickContacts(): Promise<ImportedContact[]> {
  const nav = navigator as any;
  const res: { name?: string[]; email?: string[]; tel?: string[] }[] = await nav.contacts.select(["name", "email", "tel"], { multiple: true });
  return res
    .filter((c) => c.name?.[0])
    .map((c) => ({ full_name: c.name![0], email: c.email?.[0], phone: c.tel?.[0] }));
}
