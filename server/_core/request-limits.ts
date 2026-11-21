export type RequestLimitEnvironment = Record<string, string | undefined>;

const KIB = 1024;
const MIB = KIB * KIB;
const DEFAULT_JSON_LIMIT = 2 * MIB;
const DEFAULT_FORM_LIMIT = 64 * KIB;
const MIN_LIMIT = 16 * KIB;
const MAX_LIMIT = 5 * MIB;

function parseLimit(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const match = /^(\d+)\s*(b|kb|mb)?$/i.exec(value.trim());
  if (!match) throw new Error(`${name} must be a byte size such as 64kb, 2mb, or 2097152b`);
  const amount = Number(match[1]);
  const unit = (match[2] || "b").toLowerCase();
  const multiplier = unit === "mb" ? MIB : unit === "kb" ? KIB : 1;
  const bytes = amount * multiplier;
  if (!Number.isSafeInteger(bytes) || bytes < MIN_LIMIT || bytes > MAX_LIMIT) {
    throw new Error(`${name} must be between 16kb and 5mb`);
  }
  return bytes;
}

export function getRequestBodyLimits(env: RequestLimitEnvironment) {
  return {
    json: parseLimit(env.API_JSON_BODY_LIMIT, DEFAULT_JSON_LIMIT, "API_JSON_BODY_LIMIT"),
    urlencoded: parseLimit(env.API_FORM_BODY_LIMIT, DEFAULT_FORM_LIMIT, "API_FORM_BODY_LIMIT"),
  };
}
