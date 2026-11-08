import { createContext, useContext, useState, type ReactNode } from "react";
import { getLang, setLang as setGlobalLang, type Lang } from "@/lib/i18n";
import { syncPushLang } from "@/lib/push";

const Ctx = createContext<{ lang: Lang; setLang(l: Lang): void }>(null!);

/** Switching language re-mounts the app so every label is re-rendered in the new language. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang);
  const setLang = (l: Lang) => {
    setGlobalLang(l);
    setLangState(l);
    syncPushLang();
  };
  return <Ctx.Provider value={{ lang, setLang }}><div key={lang} className="contents">{children}</div></Ctx.Provider>;
}
export const useLang = () => useContext(Ctx);
