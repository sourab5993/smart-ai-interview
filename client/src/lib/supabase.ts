import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

export type PublicAppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  configured: boolean;
};
let clientPromise: Promise<SupabaseClient | null> | undefined;
let appConfig: PublicAppConfig | undefined;

export async function getPublicAppConfig(): Promise<PublicAppConfig> {
  if (appConfig) return appConfig;
  try {
    const response = await fetch("/api/app-config", { cache: "no-store" });
    const config = (await response.json()) as PublicAppConfig;
    appConfig = config;
  } catch {
    appConfig = { supabaseUrl: "", supabaseAnonKey: "", configured: false };
  }
  return appConfig;
}

export async function getSupabase(): Promise<SupabaseClient> {
  clientPromise ??= getPublicAppConfig().then(config => {
    if (!config.configured || !config.supabaseUrl || !config.supabaseAnonKey)
      return null;
    return createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
      global: { headers: { "X-Client-Info": "smart-interview-ai/1.0" } },
    });
  });
  const client = await clientPromise;
  if (!client)
    throw new Error("Supabase is not configured for this environment.");
  return client;
}

export async function currentAccessToken(): Promise<string | undefined> {
  try {
    const client = await getSupabase();
    const { data } = await client.auth.getSession();
    return (data.session as Session | null)?.access_token;
  } catch {
    return undefined;
  }
}
