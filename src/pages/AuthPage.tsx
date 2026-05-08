import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../lib/auth";

type AuthMode = "sign-in" | "sign-up";

type AuthPageProps = {
  onBack?: () => void;
};

export function AuthPage({ onBack }: AuthPageProps) {
  const {
    authError,
    loading,
    signInWithGoogle,
    signInWithPassword,
    signOut,
    signUpWithPassword,
    user
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const isSignIn = mode === "sign-in";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const { error } = isSignIn
      ? await signInWithPassword(email, password)
      : await signUpWithPassword(email, password);

    if (!error) {
      setStatus(isSignIn ? "Signed in." : "Check your email to confirm your account.");
    }
  }

  async function handleGoogleSignIn() {
    setStatus(null);
    const { error } = await signInWithGoogle();

    if (!error) {
      setStatus("Redirecting to Google.");
    }
  }

  async function handleSignOut() {
    setStatus(null);
    const { error } = await signOut();

    if (!error) {
      setStatus("Signed out.");
    }
  }

  return (
    <>
      <header className="border-b border-line/80 bg-page/90">
        <nav
          aria-label="Authentication"
          className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"
        >
          <button className="text-left text-lg font-semibold text-ink hover:text-accent" onClick={onBack} type="button">
            Web Launch Guard
          </button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {onBack ? (
              <Button className="min-h-10 px-3" onClick={onBack} variant="ghost">
                Back
              </Button>
            ) : null}
          </div>
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-12 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Account access
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-ink">
            {isSignIn ? "Sign in to Web Launch Guard" : "Create your Web Launch Guard account"}
          </h1>
          <p className="mt-5 text-base leading-7 text-muted">
            Use the auth foundation to prepare for private launch workspaces while scanner and dashboard
            workflows stay out of this release slice.
          </p>
        </section>

        <Card className="p-6">
          {user ? (
            <div aria-live="polite">
              <h2 className="text-2xl font-semibold text-ink">You are signed in</h2>
              <p className="mt-3 break-words text-sm leading-6 text-muted">{user.email}</p>
              <Button className="mt-6 w-full" disabled={loading} onClick={handleSignOut} variant="secondary">
                Sign out
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-page p-1" role="tablist">
                <button
                  aria-selected={isSignIn}
                  className={`min-h-10 rounded-md px-3 text-sm font-semibold transition ${
                    isSignIn ? "bg-panel text-ink shadow-soft" : "text-muted hover:text-ink"
                  }`}
                  onClick={() => {
                    setMode("sign-in");
                    setStatus(null);
                  }}
                  role="tab"
                  type="button"
                >
                  Sign in
                </button>
                <button
                  aria-selected={!isSignIn}
                  className={`min-h-10 rounded-md px-3 text-sm font-semibold transition ${
                    !isSignIn ? "bg-panel text-ink shadow-soft" : "text-muted hover:text-ink"
                  }`}
                  onClick={() => {
                    setMode("sign-up");
                    setStatus(null);
                  }}
                  role="tab"
                  type="button"
                >
                  Sign up
                </button>
              </div>

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm font-semibold text-ink" htmlFor="auth-email">
                    Email
                  </label>
                  <input
                    autoComplete="email"
                    className="mt-2 min-h-11 w-full rounded-lg border border-line bg-page px-3 text-ink shadow-sm focus:border-accent"
                    id="auth-email"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-ink" htmlFor="auth-password">
                    Password
                  </label>
                  <input
                    autoComplete={isSignIn ? "current-password" : "new-password"}
                    className="mt-2 min-h-11 w-full rounded-lg border border-line bg-page px-3 text-ink shadow-sm focus:border-accent"
                    id="auth-password"
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </div>

                <Button className="w-full" disabled={loading} type="submit">
                  <LogIn aria-hidden="true" size={18} />
                  {isSignIn ? "Sign in" : "Sign up"}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>

              <Button className="w-full" disabled={loading} onClick={handleGoogleSignIn} variant="secondary">
                Continue with Google
              </Button>
            </>
          )}

          {authError ? (
            <p className="mt-5 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="alert">
              {authError}
            </p>
          ) : null}
          {status ? (
            <p className="mt-5 rounded-lg border border-line bg-page px-3 py-2 text-sm text-muted" role="status">
              {status}
            </p>
          ) : null}
        </Card>
      </main>
    </>
  );
}
