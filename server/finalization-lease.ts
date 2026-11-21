import type { Pool, PoolClient } from "pg";

export type FinalizationKind = "simple" | "live";

export class FinalizationLeaseLostError extends Error {
  constructor() {
    super("The finalization lease expired or is no longer owned.");
    this.name = "FinalizationLeaseLostError";
  }
}

/**
 * Lock the parent session before its lease row for a short persistence transaction.
 * Provider calls must happen before entering this helper. The shared lock order prevents
 * claims, user writes, and finalizer persistence from deadlocking or racing snapshots.
 */
export async function withActiveFinalizationLease<T>(
  pool: Pool,
  kind: FinalizationKind,
  sessionId: string,
  claimToken: string,
  persist: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("begin");
    transactionOpen = true;

    const sessionTable =
      kind === "simple"
        ? "public.interview_sessions"
        : "public.live_interview_sessions";
    const session = await client.query(
      `select id from ${sessionTable} where id = $1 for update`,
      [sessionId]
    );
    if (session.rowCount !== 1) throw new FinalizationLeaseLostError();

    const lease = await client.query(
      `select 1
       from public.scheduled_finalizer_claims
       where session_kind = $1
         and session_id = $2
         and lease_token = $3
         and lease_until > clock_timestamp()
       for update`,
      [kind, sessionId, claimToken]
    );

    if (lease.rowCount !== 1) throw new FinalizationLeaseLostError();

    const result = await persist(client);
    await client.query("commit");
    transactionOpen = false;
    return result;
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function requireExactlyOneRow(
  rowCount: number | null,
  message: string
): void {
  if (rowCount !== 1) throw new Error(message);
}
