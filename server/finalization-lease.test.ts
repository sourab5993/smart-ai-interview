import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import {
  FinalizationLeaseLostError,
  requireExactlyOneRow,
  withActiveFinalizationLease,
} from "./finalization-lease";

function fakePool(leaseRows: number) {
  const client = {
    query: vi.fn(async (statement: string) => {
      if (statement.includes("scheduled_finalizer_claims"))
        return { rowCount: leaseRows, rows: [] };
      return { rowCount: 1, rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
  return { pool, client };
}

describe("finalization lease transaction", () => {
  it("commits short persistence only while the supplied lease token is current", async () => {
    const { pool, client } = fakePool(1);
    const persist = vi.fn(async () => "saved");

    await expect(
      withActiveFinalizationLease(
        pool,
        "simple",
        "session-1",
        "lease-1",
        persist as unknown as (client: PoolClient) => Promise<string>
      )
    ).resolves.toBe("saved");

    expect(client.query).toHaveBeenCalledWith("commit");
    expect(client.query).not.toHaveBeenCalledWith("rollback");
    expect(client.release).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(statements[1]).toContain("public.interview_sessions");
    expect(statements[2]).toContain("public.scheduled_finalizer_claims");
  });

  it("does not run writes and rolls back after lease expiry or token replacement", async () => {
    const { pool, client } = fakePool(0);
    const persist = vi.fn(async () => undefined);

    await expect(
      withActiveFinalizationLease(
        pool,
        "live",
        "session-2",
        "stale-token",
        persist as unknown as (client: PoolClient) => Promise<void>
      )
    ).rejects.toBeInstanceOf(FinalizationLeaseLostError);

    expect(persist).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(client.query).not.toHaveBeenCalledWith("commit");
    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(statements[1]).toContain("public.live_interview_sessions");
    expect(statements[2]).toContain("public.scheduled_finalizer_claims");
  });

  it("treats a zero-row session status transition as a failed commit", () => {
    expect(() => requireExactlyOneRow(1, "status changed")).not.toThrow();
    expect(() => requireExactlyOneRow(0, "status changed")).toThrow(
      "status changed"
    );
    expect(() => requireExactlyOneRow(null, "status changed")).toThrow(
      "status changed"
    );
  });
});
