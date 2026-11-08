import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface AuthState {
  ready: boolean;
  mode: "supabase" | "demo";
  email: string | null;
  signedIn: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  sendMagicLink(email: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  enterDemo(): void;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthState>(null!);
const DEMO_FLAG = "circle-demo-signed-in";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [demoIn, setDemoIn] = useState(() => {
    try { return localStorage.getItem(DEMO_FLAG) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    ready,
    mode: isSupabaseConfigured ? "supabase" : "demo",
    email: isSupabaseConfigured ? session?.user.email ?? null : "demo@circle.app",
    signedIn: isSupabaseConfigured ? Boolean(session) : demoIn,
    async signIn(email, password) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(email, password) {
      const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },
    async sendMagicLink(email) {
      const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin, shouldCreateUser: false } });
      if (error) throw error;
    },
    async resetPassword(email) {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/settings" });
      if (error) throw error;
    },
    enterDemo() {
      try { localStorage.setItem(DEMO_FLAG, "1"); } catch {}
      setDemoIn(true);
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      try { localStorage.removeItem(DEMO_FLAG); } catch {}
      setDemoIn(false);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
