import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(resolve(root, "client/src/pages/ProjectInsightsPage.tsx"), "utf8");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "client/public/routes.json"), "utf8")) as {
  routes: Array<{ path: string; title?: string }>;
};

describe("Project Insights and route manifest contracts", () => {
  it("documents each required project-insights section and pipeline stages", () => {
    for (const heading of [
      "Project Overview",
      "Problem Statement",
      "Objectives",
      "System Architecture",
      "AI Architecture / Pipeline",
      "ML Architecture / Pipeline",
      "Database Design",
      "Technology Stack",
      "AI Workflow",
      "ML Workflow",
      "Model Evaluation",
      "Security",
      "Limitations",
      "Future Scope",
    ]) {
      expect(page).toContain(`title="${heading}"`);
    }

    for (const stage of [
      "User goal and permitted context",
      "Resume/profile signals (only when available)",
      "Role-aware question generation",
      "Interview turn and persisted answer",
      "Schema-validated AI coaching evaluation",
      "Performance and skill-gap summaries",
      "Personalized practice recommendations",
      "Historical interview data",
      "Feature engineering (planned)",
      "Model (not currently trained)",
      "Training (not yet available)",
      "Validation (no holdout evaluation yet)",
      "Prediction (not available)",
      "Readiness score (transparent baseline only)",
    ]) {
      expect(page).toContain(stage);
    }
    expect(page).toMatch(/no trained predictive model or accuracy result is claimed/i);
  });

  it("has unique valid route entries that exactly cover real App routes except 404-only routes", () => {
    expect(Array.isArray(manifest.routes)).toBe(true);
    const actual = manifest.routes.map(route => route.path);
    expect(new Set(actual).size).toBe(actual.length);
    for (const route of manifest.routes) {
      expect(route.path).toMatch(/^\/(?!\/)[^\s?#]*$/);
      expect(route.path).not.toBe("/404");
      expect(route.path).not.toMatch(/^\/(api|assets|__system__)(\/|$)/);
      expect(typeof route.title === "undefined" || route.title.length <= 256).toBe(true);
    }
    const sourceRoutes = [...app.matchAll(/<Route path="([^"]+)"/g)]
      .map(match => match[1])
      .filter(route => route !== "/404");
    expect([...actual].sort()).toEqual([...sourceRoutes].sort());
    expect(actual).toContain("/project-insights");
    expect(actual).toContain("/project-status");
  });
});
