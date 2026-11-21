import { describe, expect, it, vi } from "vitest";
import { signOutSupabase } from "../client/src/lib/auth";

describe("Supabase sign out", () => {
  it("calls the active Supabase Auth signOut method", async () => {
    const auth = { signOut: vi.fn().mockResolvedValue({ error: null }) };
    await expect(signOutSupabase(auth)).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("does not claim success when the provider rejects sign-out", async () => {
    const auth = {
      signOut: vi
        .fn()
        .mockResolvedValue({ error: new Error("provider failure") }),
    };
    await expect(signOutSupabase(auth)).rejects.toThrow(
      "We couldn't complete sign out."
    );
  });
});
