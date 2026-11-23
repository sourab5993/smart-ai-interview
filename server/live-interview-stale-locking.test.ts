import { describe, expect, it } from "vitest";
import {
  isFinalizingStale,
  STALE_FINALIZING_TIMEOUT_MS,
  hasLiveInterviewDeadlineElapsed,
} from "./live-interview";

describe("Live Interview stale finalizing lock detection", () => {
  const baseTime = 1_700_000_000_000;

  it("does not flag non-finalizing sessions as stale", () => {
    expect(
      isFinalizingStale(
        {
          status: "in_progress",
          updated_at: new Date(baseTime - 120_000).toISOString(),
        },
        baseTime
      )
    ).toBe(false);

    expect(
      isFinalizingStale(
        {
          status: "completed",
          updated_at: new Date(baseTime - 120_000).toISOString(),
        },
        baseTime
      )
    ).toBe(false);

    expect(
      isFinalizingStale(
        {
          status: "failed",
          updated_at: new Date(baseTime - 120_000).toISOString(),
        },
        baseTime
      )
    ).toBe(false);

    expect(
      isFinalizingStale(
        {
          status: "abandoned",
          updated_at: new Date(baseTime - 120_000).toISOString(),
        },
        baseTime
      )
    ).toBe(false);
  });

  it("keeps recently started finalizing sessions active within timeout threshold", () => {
    // 20 seconds into finalization (under 45s threshold)
    const recentTimestamp = new Date(baseTime - 20_000).toISOString();
    expect(
      isFinalizingStale(
        {
          status: "finalizing",
          updated_at: recentTimestamp,
        },
        baseTime
      )
    ).toBe(false);
  });

  it("flags sessions stuck in finalizing past the 45-second threshold as stale", () => {
    // Exactly at threshold
    const atThreshold = new Date(
      baseTime - STALE_FINALIZING_TIMEOUT_MS
    ).toISOString();
    expect(
      isFinalizingStale(
        {
          status: "finalizing",
          updated_at: atThreshold,
        },
        baseTime
      )
    ).toBe(true);

    // 60 seconds into finalization
    const pastThreshold = new Date(baseTime - 60_000).toISOString();
    expect(
      isFinalizingStale(
        {
          status: "finalizing",
          updated_at: pastThreshold,
        },
        baseTime
      )
    ).toBe(true);

    // 10 minutes into finalization
    const veryStale = new Date(baseTime - 600_000).toISOString();
    expect(
      isFinalizingStale(
        {
          status: "finalizing",
          updated_at: veryStale,
        },
        baseTime
      )
    ).toBe(true);
  });

  it("falls back to started_at if updated_at is missing", () => {
    const oldStartedAt = new Date(baseTime - 60_000).toISOString();
    expect(
      isFinalizingStale(
        {
          status: "finalizing",
          started_at: oldStartedAt,
        },
        baseTime
      )
    ).toBe(true);

    const recentStartedAt = new Date(baseTime - 10_000).toISOString();
    expect(
      isFinalizingStale(
        {
          status: "finalizing",
          started_at: recentStartedAt,
        },
        baseTime
      )
    ).toBe(false);
  });
});
