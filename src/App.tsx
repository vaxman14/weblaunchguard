import { useEffect, useState } from "react";
import { A11yWidget } from "./features/a11y/A11yWidget";
import { CookieBanner } from "./features/cookies/CookieBanner";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { CookiePolicyPage } from "./pages/legal/CookiePolicyPage";
import { EulaPage } from "./pages/legal/EulaPage";
import { PrivacyPage } from "./pages/legal/PrivacyPage";
import { TermsPage } from "./pages/legal/TermsPage";
import { ReportPage } from "./pages/ReportPage";

function AppContent() {
  const { session, user } = useAuth();
  const [hash, setHash] = useState(() => window.location.hash);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  useEffect(() => {
    function handleHashChange() {
      setHash(window.location.hash);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const showAuth = hash === "#auth";
  const showAdmin = hash === "#admin";
  const showPrivacy = hash === "#privacy";
  const showTerms = hash === "#terms";
  const showEula = hash === "#eula";
  const showCookies = hash === "#cookies";

  function openAuth() {
    window.location.hash = "auth";
  }

  function closeAuth() {
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
    setHash("");
  }

  function openAdmin() {
    window.location.hash = "admin";
  }

  function closeAdmin() {
    window.location.hash = "";
  }

  function goBack() {
    window.location.hash = "";
  }

  if (showPrivacy) return <><PrivacyPage onBack={goBack} /><A11yWidget /></>;
  if (showTerms) return <><TermsPage onBack={goBack} /><A11yWidget /></>;
  if (showEula) return <><EulaPage onBack={goBack} /><A11yWidget /></>;
  if (showCookies) return <><CookiePolicyPage onBack={goBack} /><A11yWidget /></>;

  return (
    <div className="min-h-screen bg-page text-ink">
      {user ? (
        showAdmin ? (
          <AdminPage onBack={closeAdmin} />
        ) : activeReportId ? (
          <ReportPage
            accessToken={session?.access_token}
            onBack={() => setActiveReportId(null)}
            reportId={activeReportId}
          />
        ) : (
          <DashboardPage onAdminOpen={openAdmin} onReportOpen={setActiveReportId} />
        )
      ) : showAuth ? (
        <AuthPage onBack={closeAuth} />
      ) : (
        <HomePage onAuthOpen={openAuth} />
      )}
      <CookieBanner />
      <A11yWidget />
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
