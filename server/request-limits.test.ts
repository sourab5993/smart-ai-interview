import { describe, expect, it } from "vitest";
import { getRequestBodyLimits } from "./_core/request-limits";

describe("configured request body limits", () => {
  it("uses safe defaults sized for bounded interview data and small form posts", () => {
    expect(getRequestBodyLimits({})).toEqual({
      json: 2 * 1024 * 1024,
      urlencoded: 64 * 1024,
    });
  });

  it("accepts bounded operator overrides with explicit byte units", () => {
    expect(getRequestBodyLimits({ API_JSON_BODY_LIMIT: "3mb", API_FORM_BODY_LIMIT: "128kb" })).toEqual({
      json: 3 * 1024 * 1024,
      urlencoded: 128 * 1024,
    });
    expect(getRequestBodyLimits({ API_JSON_BODY_LIMIT: "65536b" }).json).toBe(65536);
  });

  it.each(["0b", "15kb", "6mb", "infinite", "1gb", "-1mb"]) (
    "rejects unsafe JSON limits (%s)", value => {
      expect(() => getRequestBodyLimits({ API_JSON_BODY_LIMIT: value })).toThrow(/API_JSON_BODY_LIMIT/);
    }
  );

  it("rejects oversized form limits independently", () => {
    expect(() => getRequestBodyLimits({ API_FORM_BODY_LIMIT: "8mb" })).toThrow(/API_FORM_BODY_LIMIT/);
  });
});
