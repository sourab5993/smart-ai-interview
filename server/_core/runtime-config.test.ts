import { describe, expect, it } from "vitest";
import { productionConfigIssues } from "./runtime-config";

describe("production environment validation", () => {
  it("does not block local development configuration", () => {
    expect(productionConfigIssues({ NODE_ENV: "development" })).toEqual([]);
  });

  it("requires secure Supabase settings and a Gemini key for production", () => {
    expect(productionConfigIssues({ NODE_ENV: "production" })).toEqual([
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "GEMINI_API_KEY",
      "SUPABASE_DB_URL (required for shared Gemini rate limiting)",
    ]);
  });

  it("rejects HTTP Supabase URLs, service-role keys, and invalid ports", () => {
    const serviceRolePayload = Buffer.from(
      JSON.stringify({ role: "service_role" })
    ).toString("base64url");
    const issues = productionConfigIssues({
      NODE_ENV: "production",
      SUPABASE_URL: "http://supabase.example",
      SUPABASE_ANON_KEY: `header.${serviceRolePayload}.signature`,
      GEMINI_API_KEY: "configured",
      PORT: "70000",
    });

    expect(issues).toContain("SUPABASE_URL (must use HTTPS)");
    expect(issues).toContain(
      "SUPABASE_ANON_KEY (must not be a service-role key)"
    );
    expect(issues).toContain("PORT (must be an integer from 1 to 65535)");
  });

  it("requires the shared limiter database and validates scheduler secrets", () => {
    expect(
      productionConfigIssues({
        NODE_ENV: "production",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "sb_publishable_public",
        GEMINI_API_KEY: "configured",
        SCHEDULER_SHARED_SECRET: "s".repeat(32),
      })
    ).toEqual(["SUPABASE_DB_URL (required for shared Gemini rate limiting)"]);
  });
});
