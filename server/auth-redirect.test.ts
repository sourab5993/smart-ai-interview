import { describe, expect, it } from "vitest";
import { authRedirectUrl } from "../client/src/lib/auth-redirect";

describe("Supabase redirect URLs", () => {
  it("keeps signup verification on the published application origin", () => {
    expect(
      authRedirectUrl("/onboarding", "https://preview.example")
    ).toBe("https://preview.example/onboarding");
  });

  it("keeps password recovery on the local development origin", () => {
    expect(authRedirectUrl("/reset-password", "http://localhost:3000")).toBe(
      "http://localhost:3000/reset-password"
    );
  });

  it("does not preserve a user-controlled path or query", () => {
    expect(authRedirectUrl("/onboarding", "https://preview.example/app")).toBe(
      "https://preview.example/onboarding"
    );
  });
});
