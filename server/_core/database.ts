export function verifiedPostgresOptions(
  env: NodeJS.ProcessEnv
) {
  const connectionString = env.SUPABASE_DB_URL?.trim();
  if (!connectionString)
    throw new Error("Supabase Postgres is not configured for this environment.");

  const databaseUrl = new URL(connectionString);
  if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:")
    throw new Error("Supabase database URL must use PostgreSQL.");

  for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"])
    databaseUrl.searchParams.delete(key);

  const ca = env.SUPABASE_DB_SSL_CA?.replace(/\\n/g, "\n").trim();
  const rejectUnauthorized =
    env.SUPABASE_DB_SSL_REJECT_UNAUTHORIZED === "true" ? true : false;
  return {
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized, ...(ca ? { ca } : {}) },
  };
}