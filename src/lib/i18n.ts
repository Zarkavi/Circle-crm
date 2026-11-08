import { tr as trLocale } from "date-fns/locale";
import { TR } from "./i18n-tr";

export type Lang = "en" | "tr";
const KEY = "circle-lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "tr") return saved;
  } catch {}
  return navigator.language?.toLowerCase().startsWith("tr") ? "tr" : "en";
}

let lang: Lang = detect();
document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem(KEY, l); } catch {}
}

/** English text is the key; Turkish comes from the dictionary. `{name}` placeholders get filled from vars. */
export function t(s: string, vars?: Record<string, string | number>) {
  let out = lang === "tr" ? TR[s] ?? s : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

export const dateLocale = () => (lang === "tr" ? trLocale : undefined);
