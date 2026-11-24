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
const FALLBACK_SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://trwteizkezvyzcekbjoj.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "sb_publishable_MbehJEwtARhv-ip-WgL0tg_T6WkpQLE";

let clientPromise: Promise<SupabaseClient | null> | undefined;
let appConfig: PublicAppConfig | undefined;

export async function getPublicAppConfig(): Promise<PublicAppConfig> {
  if (appConfig && appConfig.configured) return appConfig;
  try {
    const response = await fetch("/api/app-config", { cache: "no-store" });
    if (response.ok) {
      const config = (await response.json()) as PublicAppConfig;
      if (config.configured && config.supabaseUrl && config.supabaseAnonKey) {
        appConfig = config;
        return appConfig;
      }
    }
  } catch (err) {
    console.warn("Unable to fetch /api/app-config, falling back to static config:", err);
  }

  if (FALLBACK_SUPABASE_URL && FALLBACK_SUPABASE_ANON_KEY) {
    appConfig = {
      supabaseUrl: FALLBACK_SUPABASE_URL,
      supabaseAnonKey: FALLBACK_SUPABASE_ANON_KEY,
      configured: true,
    };
    return appConfig;
  }

  return { supabaseUrl: "", supabaseAnonKey: "", configured: false };
}

export async function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = getPublicAppConfig().then(config => {
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
  }
  const client = await clientPromise;
  if (!client) {
    clientPromise = undefined;
    throw new Error("Supabase is not configured for this environment.");
  }
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
