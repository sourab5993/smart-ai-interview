import { describe, expect, it } from "vitest";
import { verifiedPostgresOptions } from "./database";

describe("verified Postgres connection options", () => {
  it("strips URL flags that could weaken TLS and always verifies the certificate", () => {
    const options = verifiedPostgresOptions({
      SUPABASE_DB_URL:
        "postgresql://user:password@db.example.com:5432/postgres?sslmode=no-verify&sslrootcert=untrusted.pem",
      SUPABASE_DB_SSL_CA: "-----BEGIN CERTIFICATE-----\\ntrusted\\n-----END CERTIFICATE-----",
    });

    const url = new URL(options.connectionString);
    expect(url.search).toBe("");
    expect(options.ssl).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----\ntrusted\n-----END CERTIFICATE-----",
    });
  });

  it("rejects missing and non-Postgres connection URLs", () => {
    expect(() =>
      verifiedPostgresOptions({ SUPABASE_DB_URL: "", SUPABASE_DB_SSL_CA: "" })
    ).toThrow("Supabase Postgres is not configured");
    expect(() =>
      verifiedPostgresOptions({
        SUPABASE_DB_URL: "https://example.com",
        SUPABASE_DB_SSL_CA: "",
      })
    ).toThrow("must use PostgreSQL");
  });
});
