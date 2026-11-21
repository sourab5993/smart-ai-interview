import "dotenv/config";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { verifiedPostgresOptions } from "../server/_core/database";

async function main() {
  const client = new Client({
    ...verifiedPostgresOptions(process.env),
    connectionTimeoutMillis: 12_000,
    query_timeout: 60_000,
  });
  try {
    await client.connect();
    await client.query(
      "create table if not exists public.app_schema_migrations (name text primary key, applied_at timestamptz not null default now())"
    );
    await client.query(
      "alter table public.app_schema_migrations enable row level security"
    );
    await client.query(
      "revoke all on table public.app_schema_migrations from public, anon, authenticated"
    );
    const dir = path.resolve("supabase/migrations");
    const files = (await readdir(dir)).filter(f => f.endsWith(".sql")).sort();
    for (const name of files) {
      const already = await client.query(
        "select 1 from public.app_schema_migrations where name=$1",
        [name]
      );
      if (already.rowCount) {
        console.log(`skip ${name}`);
        continue;
      }
      const sql = await readFile(path.join(dir, name), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into public.app_schema_migrations(name) values($1)",
          [name]
        );
        await client.query("commit");
        console.log(`applied ${name}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
            .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted connection]")
            .slice(0, 360)
        : "unknown database error";
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : "";
    console.error(
      `Supabase schema setup failed${code ? ` (${code})` : ""}: ${detail}. Connection credentials are not logged.`
    );
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}
void main();
