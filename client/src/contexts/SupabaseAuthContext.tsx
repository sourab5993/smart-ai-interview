import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getPublicAppConfig, getSupabase } from "@/lib/supabase";
import { signOutSupabase } from "@/lib/auth";

export type AuthState = {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const config = await getPublicAppConfig();
      if (!active) return;
      setConfigured(config.configured);
      if (!config.configured) {
        setReady(true);
        return;
      }
      try {
        const client = await getSupabase();
        const { data } = await client.auth.getSession();
        if (active) setSession(data.session);
        const { data: listener } = client.auth.onAuthStateChange(
          (_event, next) => {
            if (active) setSession(next);
          }
        );
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch {
        if (active) setConfigured(false);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      configured,
      session,
      user: session?.user ?? null,
      logout: async () => {
        const client = await getSupabase();
        await signOutSupabase(client.auth);
      },
      refresh: async () => {
        const client = await getSupabase();
        const { data } = await client.auth.getSession();
        setSession(data.session);
      },
    }),
    [ready, configured, session]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  const value = useContext(AuthContext);
  if (!value)
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  return value;
}
