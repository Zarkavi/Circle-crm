import { useState, type FormEvent } from "react";
import { Lock, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/state/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/shell";
import { t } from "@/lib/i18n";

export function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await auth.signIn(email, password);
      else if (mode === "signup") {
        const r = await auth.signUp(email, password);
        if (r.needsConfirmation) setSent(t("Check your inbox to confirm your email, then sign in."));
      } else {
        await auth.sendMagicLink(email);
        setSent(t("We sent you a sign-in link. Open it on this device."));
      }
    } catch (err: any) {
      toast.error(err?.message ?? t("Sign-in failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-safe relative grid min-h-dvh place-items-center overflow-hidden px-5">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[680px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-500/30 via-indigo-500/20 to-sky-400/10 blur-3xl" />
      <div className="relative w-full max-w-sm animate-in">
        <Logo className="mb-8 justify-center text-xl" />
        <div className="rounded-3xl border bg-card/80 p-6 shadow-xl shadow-black/5 backdrop-blur">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "signup" ? t("Create your account") : t("Welcome back")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("Your private notes about the people in your life.")}</p>

          {auth.mode === "demo" ? (
            <div className="mt-6 grid gap-3">
              <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                {t("Supabase isn't connected yet, so login is off. You can try the app with sample data saved only in this browser.")}
              </div>
              <Button size="lg" onClick={auth.enterDemo}><Sparkles /> {t("Try the demo")}</Button>
            </div>
          ) : sent ? (
            <div className="mt-6 rounded-xl bg-accent p-4 text-sm text-accent-foreground">{sent}
              <Button variant="link" className="mt-2 block h-auto" onClick={() => { setSent(null); setMode("signin"); }}>{t("Back to sign in")}</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 grid gap-4">
              <Field label={t("Email")}><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              {mode !== "magic" && (
                <Field label={t("Password")}>
                  <Input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              )}
              <Button size="lg" disabled={busy}>
                {mode === "magic" ? <Mail /> : <Lock />}
                {busy ? t("Please wait…") : mode === "signin" ? t("Sign in") : mode === "signup" ? t("Create account") : t("Email me a link")}
              </Button>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "magic" ? "signin" : "magic")}>
                  {mode === "magic" ? t("Use password") : t("Sign in with email link")}
                </button>
                <button type="button" className="text-primary hover:underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                  {mode === "signup" ? t("I have an account") : t("Create account")}
                </button>
              </div>
              {mode === "signin" && (
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    if (!email) return toast.error(t("Enter your email first"));
                    try { await auth.resetPassword(email); toast.success(t("Password reset email sent")); } catch (e: any) { toast.error(e.message); }
                  }}>
                  {t("Forgot password?")}
                </button>
              )}
            </form>
          )}
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" /> {t("Only you can see your data.")}
        </p>
      </div>
    </div>
  );
}
