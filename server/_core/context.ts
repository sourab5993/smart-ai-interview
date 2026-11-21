import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export type AppUser = {
  id: string;
  email: string | null;
  name: string;
  role: "user" | "admin";
};
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AppUser | null;
  accessToken: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const authorization = opts.req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey)
    return { req: opts.req, res: opts.res, user: null, accessToken: null };

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(7000),
      }
    );
    if (!response.ok)
      return { req: opts.req, res: opts.res, user: null, accessToken: null };
    const authUser = (await response.json()) as {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    };
    let role: "user" | "admin" = "user";
    const profileResponse = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(authUser.id)}&limit=1`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (profileResponse.ok) {
      const profiles = (await profileResponse.json()) as Array<{
        role?: string;
      }>;
      if (profiles[0]?.role === "admin") role = "admin";
    }
    const metadataName = authUser.user_metadata?.full_name;
    return {
      req: opts.req,
      res: opts.res,
      user: {
        id: authUser.id,
        email: authUser.email ?? null,
        name:
          typeof metadataName === "string"
            ? metadataName
            : (authUser.email ?? "Candidate"),
        role,
      },
      accessToken: token,
    };
  } catch {
    return { req: opts.req, res: opts.res, user: null, accessToken: null };
  }
}
