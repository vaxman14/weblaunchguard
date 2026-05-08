import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

export const supabase: SupabaseClient | null = supabaseEnv.isConfigured
  ? createClient(supabaseEnv.url, supabaseEnv.anonKey)
  : null;

export const supabaseConfigMessage = supabaseEnv.message;
