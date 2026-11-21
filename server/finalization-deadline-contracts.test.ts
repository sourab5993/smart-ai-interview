import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202610240003_scheduled_work.sql"
  ),
  "utf8"
);
const simplePage = readFileSync(
  resolve(process.cwd(), "client/src/pages/InterviewPages.tsx"),
  "utf8"
);

function functionBody(name: string): string {
  const marker = `create or replace function public.${name}(`;
  const start = migration.lastIndexOf(marker);
  expect(start, `migration function ${name} exists`).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf("$$;", start);
  expect(end, `migration function ${name} terminates`).toBeGreaterThan(start);
  return migration.slice(start, end + 3);
}

describe("database deadline-write contracts", () => {
  it("routes Simple answers through an owner, status, deadline and question-scoped lock", () => {
    const save = functionBody("save_simple_interview_answer");
    expect(simplePage).toContain('"save_simple_interview_answer"');
    expect(simplePage).not.toMatch(/\.from\("interview_answers"\)\s*\.upsert/);
    expect(save).toMatch(/owner_id\s*=\s*auth\.uid\(\)/i);
    expect(save).toMatch(/for update/i);
    expect(save).toMatch(/parent\.status\s*<>\s*'in_progress'/i);
    expect(save).toMatch(
      /clock_timestamp\(\)\s*>=\s*parent\.created_at\s*\+\s*make_interval/i
    );
    expect(save).toContain("scheduled_finalizer_claims");
    expect(save).toContain("interview_questions");
  });

  it("keeps legacy PostgREST answer writes behind the same session lock and deadline", () => {
    const trigger = functionBody("enforce_interview_answer_deadline");
    expect(trigger).toMatch(/security definer/i);
    expect(trigger).toMatch(/for update/i);
    expect(trigger).toMatch(/clock_timestamp\(\)\s*>=\s*parent\.created_at/i);
    expect(trigger).toContain("scheduled_finalizer_claims");
  });

  it("rejects Live camera summaries at and after the server deadline", () => {
    const save = functionBody("save_live_interview_camera_summary");
    const deadlineChecks = save.match(/deadline_at\s*>\s*clock_timestamp\(\)/gi) || [];
    expect(deadlineChecks).toHaveLength(2);
    expect(save).toMatch(/status\s*=\s*'in_progress'/i);
    expect(save).toMatch(/for update/i);
  });
});
