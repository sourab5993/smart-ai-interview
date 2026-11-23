// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(async () => ({})),
  queryResult: {
    isLoading: false,
    error: null,
    data: {
      session: {
        id: "session-fixture",
        target_role: "Frontend Engineer",
        duration_minutes: 20,
        speech_language: "en-US",
        status: "in_progress",
        started_at: "2099-01-01T10:00:00.000Z",
        deadline_at: "2099-01-01T10:20:00.000Z",
        completed_at: null,
        camera_summary: null,
        report: null,
      },
      turns: [
        {
          id: "turn-fixture",
          turn_index: 0,
          question_text: "Tell me about a project you are proud of.",
          question_type: "opening",
          difficulty: "Medium",
          competencies: ["communication"],
          parent_turn_id: null,
          transcript: "I led a small team to improve the onboarding flow.",
          transcript_status: "completed",
          evaluation: null,
          evaluation_status: "pending",
        },
      ],
    },
  },
}));

vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutateAsync: mocks.mutateAsync }) };
  return {
    trpc: {
      liveInterview: {
        get: { useQuery: () => mocks.queryResult },
        saveTranscript: mutation,
        evaluateTurn: mutation,
        saveQuestion: mutation,
        finalize: mutation,
        forceEnd: mutation,
        saveCameraSummary: mutation,
      },
      ai: { generateQuestions: mutation },
      voice: { transcribeStoredAudio: mutation },
    },
  };
});

vi.mock("wouter", async importOriginal => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    useParams: () => ({ id: "session-fixture" }),
    useLocation: () => ["/live-interview/session-fixture", vi.fn()],
  };
});

import { LiveInterviewRoom } from "./LiveInterviewPages";

afterEach(() => cleanup());

describe("LiveInterviewRoom presentation", () => {
  it("renders three panels from saved data while keeping camera access off", async () => {
    const { container } = render(<LiveInterviewRoom />);

    expect(
      await screen.findByRole("heading", {
        name: "Tell me about a project you are proud of.",
      })
    ).toBeTruthy();
    expect(
      screen.getByText("I led a small team to improve the onboarding flow.")
    ).toBeTruthy();
    expect(screen.getByText("Your camera is off")).toBeTruthy();
    expect(
      screen.getByRole("log", { name: "Interview conversation transcript" })
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: "Opt in to optional on-device framing observations",
      })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Turn camera on" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(container.querySelectorAll(".live-room-panel")).toHaveLength(3);
    expect(container.querySelector("video")).toBeNull();
  });
});
