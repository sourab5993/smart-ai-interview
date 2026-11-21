import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { projectOutcomes } from "../client/src/lib/project-status-data";

const root = process.cwd();
const todo = readFileSync(resolve(root, "TODO.md"), "utf8");
const page = readFileSync(resolve(root, "client/src/pages/ProjectStatusPage.tsx"), "utf8");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const auth = readFileSync(resolve(root, "client/src/pages/AuthPage.tsx"), "utf8");
const onboarding = readFileSync(resolve(root, "client/src/pages/Onboarding.tsx"), "utf8");
const appShell = readFileSync(resolve(root, "client/src/components/app/AppShell.tsx"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "client/public/routes.json"), "utf8")) as {
  routes: Array<{ path: string; title?: string }>;
};

const sourceOutcomes = todo
  .split("\n")
  .flatMap(line => {
    const match = line.match(/^## (✅|⬜) ([\dA-Z]+)\. (.+)$/);
    if (!match) return [];
    return [{ id: match[2], status: match[1] === "✅" ? "complete" : "open", title: match[3] }];
  });
const publicTitle = (title: string) => title
  .replace("Fast Gemini report responses", "Fast report responses")
  .replace("Gemini question generation", "AI question generation");

describe("public project progress page", () => {
  it("shows every acceptance outcome with the same completion state as TODO.md", () => {
    expect(projectOutcomes.map(({ id, status, title }) => ({ id, status, title }))).toEqual(
      sourceOutcomes.map(outcome => ({ ...outcome, title: publicTitle(outcome.title) }))
    );
    expect(projectOutcomes.filter(outcome => outcome.status === "complete")).toHaveLength(8);
    expect(projectOutcomes.filter(outcome => outcome.status === "open")).toHaveLength(21);
  });

  it("is public, discoverable from the landing page, and declared in the route manifest", () => {
    expect(app).toContain('<Route path="/project-status" component={ProjectStatusPage} />');
    expect(home).toContain('href="/project-status"');
    expect(manifest.routes).toContainEqual({ path: "/project-status", title: "Project progress" });
    expect(manifest.routes).toHaveLength(28);
  });

  it("uses SMART INTERVIEW only across landing, auth, onboarding and workspace wordmarks", () => {
    const brandSurfaces = [home, auth, onboarding, appShell].join("\n");
    expect(brandSurfaces).not.toMatch(/SMART\s*(?:<b>)?INTERVIEW\s+AI/i);
    expect(brandSurfaces).not.toContain("SMART AI INTERVIEW PREPARATION");
  });

  it("explains partial implementation, Supabase exclusion and live verification limits", () => {
    expect(page).toMatch(/open outcome can have working local code/i);
    expect(page).toMatch(/credentials, queries or migrations used/i);
    expect(page).toMatch(/Live provider and real-device behavior are not claimed as verified/i);
    expect(page).toContain("Supabase-dependent");
    expect(page).toContain("Project Insights");
  });
});
