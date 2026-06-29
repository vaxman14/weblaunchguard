import { useEffect, useState } from "react";
import { CookieBanner } from "./features/cookies/CookieBanner";
import { ThemeProvider } from "./lib/theme";
import { HomePage } from "./pages/HomePage";
import { CookiePolicyPage } from "./pages/legal/CookiePolicyPage";
import { EulaPage } from "./pages/legal/EulaPage";
import { PrivacyPage } from "./pages/legal/PrivacyPage";
import { TermsPage } from "./pages/legal/TermsPage";

function AppContent() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    function onHash() {
      setHash(window.location.hash);
    }
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);

  function goBack() {
    window.location.hash = "";
  }

  if (hash === "#privacy") return <PrivacyPage onBack={goBack} />;
  if (hash === "#terms") return <TermsPage onBack={goBack} />;
  if (hash === "#eula") return <EulaPage onBack={goBack} />;
  if (hash === "#cookies") return <CookiePolicyPage onBack={goBack} />;

  return (
    <div className="min-h-screen bg-page text-ink">
      <HomePage />
      <CookieBanner />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
