import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/state/auth";
import { DataProvider } from "@/state/data";
import { ThemeProvider, useTheme } from "@/state/theme";
import { LangProvider } from "@/state/lang";
import { ConfirmProvider } from "@/components/confirm";
import { QuickAddProvider } from "@/components/quick-add";
import { Shell } from "@/components/shell";
import { LoginPage } from "@/pages/login";
import { TodayPage } from "@/pages/today";
import { PeoplePage } from "@/pages/people";
import { PersonPage } from "@/pages/person";
import { SearchPage } from "@/pages/search";
import { RemindersPage } from "@/pages/reminders";
import { SettingsPage } from "@/pages/settings";

function Gate() {
  const { ready, signedIn, email } = useAuth();
  if (!ready) return <div className="grid min-h-dvh place-items-center"><div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!signedIn) return <LoginPage />;
  return (
    // keyed by user so switching accounts never shows stale data
    <DataProvider key={email ?? "anon"}>
      <ConfirmProvider>
        <QuickAddProvider>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<TodayPage />} />
              <Route path="people" element={<PeoplePage />} />
              <Route path="people/:id" element={<PersonPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="reminders" element={<RemindersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </QuickAddProvider>
      </ConfirmProvider>
    </DataProvider>
  );
}

function Toasts() {
  const { theme } = useTheme();
  return <Toaster position="top-center" theme={theme} richColors closeButton={false} toastOptions={{ className: "!rounded-xl" }} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
          <Toasts />
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
