import { describe, expect, it } from "vitest";
import {
  canEvaluateLiveTurn,
  hasLiveInterviewDeadlineElapsed,
} from "./live-interview";

describe("server-authoritative Live Interview deadline", () => {
  const deadline = "2026-10-24T12:00:00.000Z";
  const boundary = Date.parse(deadline);

  it("allows the exact second before expiry", () => {
    expect(hasLiveInterviewDeadlineElapsed(deadline, boundary - 1)).toBe(false);
  });

  it("treats the exact deadline as expired", () => {
    expect(hasLiveInterviewDeadlineElapsed(deadline, boundary)).toBe(true);
  });

  it("keeps future sessions active", () => {
    expect(hasLiveInterviewDeadlineElapsed(deadline, boundary - 60_000)).toBe(false);
  });

  it("accepts evaluations only before a session enters finalization", () => {
    expect(canEvaluateLiveTurn("in_progress")).toBe(true);
    expect(canEvaluateLiveTurn("finalizing")).toBe(false);
    expect(canEvaluateLiveTurn("failed")).toBe(false);
    expect(canEvaluateLiveTurn("completed")).toBe(false);
    expect(canEvaluateLiveTurn("abandoned")).toBe(false);
  });
});
