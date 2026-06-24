import { useEffect, useState } from "react";
import { A11yWidget } from "./features/a11y/A11yWidget";
import { CookieBanner } from "./features/cookies/CookieBanner";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ReportPage } from "./pages/ReportPage";
import { SampleReportPage } from "./pages/SampleReportPage";
import { SharedReportPage } from "./pages/SharedReportPage";
import { CookiePolicyPage } from "./pages/legal/CookiePolicyPage";
import { EulaPage } from "./pages/legal/EulaPage";
import { PrivacyPage } from "./pages/legal/PrivacyPage";
import { TermsPage } from "./pages/legal/TermsPage";

function AppContent() {
  const { session, user } = useAuth();
  const [hash, setHash] = useState(() => window.location.hash);
  const [search, setSearch] = useState(() => window.location.search);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  useEffect(() => {
    function handlePopState() {
      setHash(window.location.hash);
      setSearch(window.location.search);
    }

    window.addEventListener("hashchange", handlePopState);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("hashchange", handlePopState);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Parse share token from ?share=TOKEN query param
  const shareToken = new URLSearchParams(search).get("share");

  const showAuth = hash === "#auth";
  const showAdmin = hash === "#admin";
  const showPrivacy = hash === "#privacy";
  const showTerms = hash === "#terms";
  const showEula = hash === "#eula";
  const showCookies = hash === "#cookies";
  const showSampleReport = hash === "#sample-report";
  const showOnboarding = hash === "#onboarding";

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

  function openSampleReport() {
    window.location.hash = "sample-report";
  }

  function goBack() {
    window.location.hash = "";
  }

  // Shared report — accessible without auth
  if (shareToken) {
    return (
      <>
        <SharedReportPage onAuthOpen={openAuth} shareToken={shareToken} />
        <A11yWidget />
        <CookieBanner />
      </>
    );
  }

  if (showPrivacy) return <><PrivacyPage onBack={goBack} /><A11yWidget /></>;
  if (showTerms) return <><TermsPage onBack={goBack} /><A11yWidget /></>;
  if (showEula) return <><EulaPage onBack={goBack} /><A11yWidget /></>;
  if (showCookies) return <><CookiePolicyPage onBack={goBack} /><A11yWidget /></>;
  if (showSampleReport) {
    return (
      <>
        <SampleReportPage onAuthOpen={openAuth} onBack={goBack} />
        <A11yWidget />
        <CookieBanner />
      </>
    );
  }

  if (showOnboarding && user) {
    return (
      <>
        <OnboardingPage onFinish={goBack} />
        <A11yWidget />
      </>
    );
  }

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
        <HomePage onAuthOpen={openAuth} onSampleReport={openSampleReport} />
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
