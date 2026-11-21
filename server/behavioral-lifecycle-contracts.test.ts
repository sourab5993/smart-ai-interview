import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202611030001_behavioral_atomic_lifecycle.sql"),
  "utf8"
);
const backend = readFileSync(resolve(process.cwd(), "server/behavioral.ts"), "utf8");
const migrationRunner = readFileSync(resolve(process.cwd(), "scripts/migrate-supabase.ts"), "utf8");
const database = readFileSync(resolve(process.cwd(), "server/_core/database.ts"), "utf8");

function functionBody(name: string): string {
  const marker = `create or replace function public.${name}(`;
  const start = migration.lastIndexOf(marker);
  expect(start, `migration function ${name} exists`).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf("$$;", start);
  expect(end, `migration function ${name} terminates`).toBeGreaterThan(start);
  return migration.slice(start, end + 3);
}

function sqlScorerBody(): string {
  const marker = "create or replace function public.compute_behavioral_observation_summary(";
  const start = migration.indexOf(marker);
  expect(start, "raw-observation scorer exists").toBeGreaterThanOrEqual(0);
  const end = migration.indexOf("$function$;", start);
  expect(end, "raw-observation scorer terminates").toBeGreaterThan(start);
  return migration.slice(start, end + "$function$;".length);
}

describe("behavioral database lifecycle contracts", () => {
  it("keeps PostgreSQL migration TLS certificate verification enabled", () => {
    expect(migrationRunner).toContain("verifiedPostgresOptions(process.env)");
    expect(database).toContain("rejectUnauthorized: true");
    expect(database).toContain("SUPABASE_DB_SSL_CA");
    expect(database).toContain('"sslmode"');
    expect(database).not.toContain("rejectUnauthorized: false");
  });

  it("saves an answer and replaces its observations under one authenticated parent-row lock", () => {
    const save = functionBody("save_behavioral_answer");
    expect(save).toMatch(/security definer/i);
    expect(save).toMatch(/auth\.uid\(\)/i);
    expect(save).toMatch(/where s\.id\s*=\s*p_session_id and s\.owner_id\s*=\s*v_owner_id/i);
    expect(save).toMatch(/for update/i);
    expect(save).toMatch(/v_status\s*<>\s*'in_progress'/i);
    expect(save).toContain("on conflict (behavioral_session_id, behavioral_question_id)");
    expect(save).toContain("delete from public.behavioral_observations");
    expect(save).toContain("insert into public.behavioral_observations");
    expect(save).toContain("jsonb_array_length(p_observations) > 600");
    expect(save).toContain("pg_column_size(p_observations) > 262144");
    expect(save).toMatch(/nullif\(btrim\(p_transcript\),\s*''\) is null/i);
    expect(save).toMatch(/p_duration_seconds\s*<=\s*0/i);
    expect(save).toContain("trackingReliable");
    expect(save).toContain("public.compute_behavioral_observation_summary(v_raw_observations)");
    expect(save).toContain("entry.value->'payload'->>'trackingReliable' = 'true'");
    expect(save).toContain("entry.value->'payload'->>'faceVisible' = 'true'");
    expect(save).not.toContain("p_observation_summary->'categories'");
    expect(save).not.toContain("p_observation_summary->>'behavioralScore'");
    expect(backend).toContain('"rpc/save_behavioral_answer"');
  });

  it("derives category totals and sample adequacy from raw frame payloads, not client summaries", () => {
    const scorer = sqlScorerBody();
    expect(scorer).toContain("jsonb_array_elements(coalesce(p_observations");
    expect(scorer).toContain("trackingReliable");
    expect(scorer).toContain("faceVisible");
    expect(scorer).toContain("reliable_frames >= 8 and sample_duration >= 3.5");
    expect(scorer).toContain("camera_gaze_frames / gaze_frames");
    expect(scorer).toContain("head_noise * 1.4");
    expect(scorer).toContain("from face_event_groups");
    expect(scorer).toContain("additional_visible_face");
    expect(scorer).not.toContain("p_observation_summary");
    expect(scorer).not.toContain("observation_summary->'categories'");
  });

  it("recomputes the report from stored answer evaluations and commits completion atomically", () => {
    const complete = functionBody("complete_behavioral_session");
    expect(complete).toMatch(/security definer/i);
    expect(complete).toMatch(/where s\.id\s*=\s*p_session_id and s\.owner_id\s*=\s*v_owner_id/i);
    expect(complete).toMatch(/for update/i);
    expect(complete).toContain("v_question_count <> v_answer_count");
    expect(complete).toContain("from public.behavioral_answers a");
    expect(complete).toContain("public.behavioral_observations o");
    expect(complete).toContain("public.compute_behavioral_observation_summary");
    expect(complete).not.toContain("a.observation_summary->'categories'");
    expect(complete).toContain("join public.answer_evaluations e");
    expect(complete).toContain("set status = 'completed'");
    expect(complete).toContain("summary = v_summary");
    expect(complete).toContain("if v_status = 'completed' then return coalesce(v_saved_summary, '{}'::jsonb)");
    expect(migration).toMatch(/revoke update on table public\.behavioral_sessions from authenticated/i);
    expect(backend).toContain('"rpc/complete_behavioral_session"');
    expect(backend).toContain("p_session_id: id");
  });

  it("prevents child writes after completion and revokes direct answer/observation mutation grants", () => {
    const guard = functionBody("enforce_behavioral_session_in_progress");
    expect(guard).toMatch(/security definer/i);
    expect(guard).toMatch(/for update/i);
    expect(guard).toContain("v_status <> 'in_progress'");
    expect(migration).toMatch(/revoke insert, update, delete on table public\.behavioral_answers, public\.behavioral_observations from authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.save_behavioral_answer/i);
    expect(migration).toMatch(/grant execute on function public\.complete_behavioral_session\(uuid\) to authenticated/i);
  });
});
