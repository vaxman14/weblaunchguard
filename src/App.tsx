import { useEffect, useState } from "react";
import { CookieBanner } from "./features/cookies/CookieBanner";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { ReportPage } from "./pages/ReportPage";

function AppContent() {
  const { session, user } = useAuth();
  const [showAuth, setShowAuth] = useState(() => window.location.hash === "#auth");
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  useEffect(() => {
    function handleHashChange() {
      setShowAuth(window.location.hash === "#auth");
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function openAuth() {
    window.location.hash = "auth";
    setShowAuth(true);
  }

  function closeAuth() {
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
    setShowAuth(false);
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      {user ? (
        activeReportId ? (
          <ReportPage
            accessToken={session?.access_token}
            onBack={() => setActiveReportId(null)}
            reportId={activeReportId}
          />
        ) : (
          <DashboardPage onReportOpen={setActiveReportId} />
        )
      ) : showAuth ? (
        <AuthPage onBack={closeAuth} />
      ) : (
        <HomePage onAuthOpen={openAuth} />
      )}
      <CookieBanner />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
