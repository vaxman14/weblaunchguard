/// <reference types="vite/client" />

type SupabaseEnv = {
  anonKey: string;
  isConfigured: boolean;
  message: string | null;
  url: string;
};

const TEST_SUPABASE_URL = "https://test-project.supabase.co";
const TEST_SUPABASE_ANON_KEY = "test-anon-key";

const viteEnv = import.meta.env;
const isTest = viteEnv.MODE === "test";

const url = viteEnv.VITE_SUPABASE_URL?.trim() || (isTest ? TEST_SUPABASE_URL : "");
const anonKey = viteEnv.VITE_SUPABASE_ANON_KEY?.trim() || (isTest ? TEST_SUPABASE_ANON_KEY : "");

const missingKeys = [
  url ? null : "VITE_SUPABASE_URL",
  anonKey ? null : "VITE_SUPABASE_ANON_KEY"
].filter((key): key is string => Boolean(key));

export const supabaseEnv: SupabaseEnv = {
  anonKey,
  isConfigured: missingKeys.length === 0,
  message: missingKeys.length
    ? `Missing Supabase configuration: ${missingKeys.join(", ")}.`
    : null,
  url
};
