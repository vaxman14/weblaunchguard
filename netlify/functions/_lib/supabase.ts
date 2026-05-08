import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { errorResponse, type NetlifyEvent, type NetlifyResponse } from "./http";

export type ServerSupabaseClient = SupabaseClient;

function supabaseUrl() {
  return process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "";
}

export function serverSupabaseClient(): ServerSupabaseClient {
  const url = supabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server configuration.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function bearerToken(event: NetlifyEvent) {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

export async function requireAuthenticatedUser(
  event: NetlifyEvent,
  client = serverSupabaseClient()
): Promise<{ response: NetlifyResponse; user?: never } | { response?: never; user: User }> {
  const token = bearerToken(event);
  if (!token) {
    return { response: errorResponse("Sign in is required.", 401) };
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { response: errorResponse("Your sign-in session could not be verified.", 401) };
  }

  return { user: data.user };
}

export async function findPersonalWorkspaceId(client: ServerSupabaseClient, user: Pick<User, "email" | "id">) {
  const { data: workspace, error } = await client
    .from("workspaces")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("workspace_type", "personal")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (workspace?.id) {
    return workspace.id as string;
  }

  const { data: createdWorkspace, error: createError } = await client
    .from("workspaces")
    .insert({
      name: user.email ? `${user.email}'s workspace` : "Personal workspace",
      owner_user_id: user.id,
      workspace_type: "personal"
    })
    .select("id")
    .single();

  if (createError || !createdWorkspace?.id) {
    throw new Error(createError?.message ?? "Personal workspace could not be created.");
  }

  return createdWorkspace.id as string;
}
