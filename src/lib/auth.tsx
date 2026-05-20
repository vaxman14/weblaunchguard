import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigMessage } from "./supabase";

export type AuthContextValue = {
  authError: string | null;
  loading: boolean;
  session: Session | null;
  signInWithGoogle: () => Promise<{ error: AuthError | Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<{ error: AuthError | Error | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function missingConfigError() {
  return new Error(supabaseConfigMessage ?? "Supabase is not configured.");
}

function errorMessage(error: AuthError | Error | null) {
  return error?.message ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(supabaseConfigMessage);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setAuthError(supabaseConfigMessage);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setAuthError(errorMessage(error));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthError(null);
      setLoading(false);

      if (window.location.hash.includes("access_token=")) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setAuthError(null);

    if (!supabase) {
      const error = missingConfigError();
      setAuthError(error.message);
      return { error };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthError(errorMessage(error));
    return { error };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    setAuthError(null);

    if (!supabase) {
      const error = missingConfigError();
      setAuthError(error.message);
      return { error };
    }

    const { error } = await supabase.auth.signUp({ email, password });
    setAuthError(errorMessage(error));
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);

    if (!supabase) {
      const error = missingConfigError();
      setAuthError(error.message);
      return { error };
    }

    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
    setAuthError(errorMessage(error));
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);

    if (!supabase) {
      const error = missingConfigError();
      setAuthError(error.message);
      return { error };
    }

    const { error } = await supabase.auth.signOut();
    setAuthError(errorMessage(error));
    return { error };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authError,
      loading,
      session,
      signInWithGoogle,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      user: session?.user ?? null
    }),
    [authError, loading, session, signInWithGoogle, signInWithPassword, signOut, signUpWithPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
