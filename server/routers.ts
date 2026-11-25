import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MAX_TRANSCRIPTION_AUDIO_BASE64_CHARS } from "@shared/const";
import {
  analyzeInterview,
  analyzeResume,
  evaluateAnswer,
  explainQuestion,
  generateQuestions,
  generateStudyPlan,
  matchJobDescription,
} from "./ai";
import { systemRouter } from "./_core/systemRouter";
import {
  completeBehavioralSession,
  createBehavioralSession,
  getBehavioralReport,
  getBehavioralSession,
  getEligibleQuestions,
  saveBehavioralAnswer,
} from "./behavioral";
import { transcribeAudioBuffer } from "./_core/voiceTranscription";
import {
  createLiveSession,
  evaluateLiveTurn,
  finalizeLiveSession,
  forceEndLiveSession,
  getActiveLiveSession,
  getLiveSession,
  listLiveSessions,
  saveLiveCameraSummary,
  saveLiveQuestion,
  saveLiveTranscript,
} from "./live-interview";
import { invokeAdminQuestionRefresh } from "./scheduled-work";
import { scheduledWorkAdapters } from "./scheduled-work-adapters";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";

async function runAi<T>(
  ctx: { user: { id: string } | null; req: { ip?: string } },
  task: () => Promise<T>
): Promise<T> {
  const userId = ctx.user?.id;
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required to use this feature.",
    });
  }

  try {
    return await task();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("runAi error:", error);
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "Your coach could not finish that request. Your work is safe—please try again.",
    });
  }
}
const shortText = (max: number) => z.string().trim().min(1).max(max);
const language = z.enum(["English", "Hindi", "Hinglish"]).default("English");
const criterion = z
  .object({
    name: shortText(80),
    description: z.string().max(400).default(""),
    weight: z.number().min(0).max(100).default(1),
  })
  .strict();
const question = z.object({
  course: shortText(120),
  specialization: z.string().max(160).optional(),
  semester: z.string().max(80).optional(),
  role: shortText(160),
  type: shortText(80),
  difficulty: shortText(30),
  skills: z.array(shortText(250)).max(30).default([]),
  count: z.number().int().min(1).max(10).default(5),
  language,
  context: z.string().max(3000).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(() => ({ success: true as const })),
  }),
  ai: router({
    generateQuestions: protectedProcedure
      .input(question)
      .mutation(({ ctx, input }) => runAi(ctx, () => generateQuestions(input))),
    evaluateAnswer: protectedProcedure
      .input(
        z.object({
          question: shortText(2000),
          answer: shortText(12000),
          course: shortText(120),
          specialization: z.string().max(160).optional(),
          semester: z.string().max(80).optional(),
          role: shortText(160),
          type: shortText(80),
          skills: z.array(shortText(250)).max(30).default([]),
          language,
          criteria: z.array(criterion).max(12).optional(),
        })
      )
      .mutation(({ ctx, input }) => runAi(ctx, () => evaluateAnswer(input))),
    analyzeResume: protectedProcedure
      .input(
        z.object({
          text: shortText(15000),
          course: shortText(120),
          role: shortText(160),
        })
      )
      .mutation(({ ctx, input }) => runAi(ctx, () => analyzeResume(input))),
    matchJob: protectedProcedure
      .input(
        z.object({
          resume: shortText(10000),
          course: shortText(120),
          role: shortText(160),
          skills: z.array(shortText(250)).max(30).default([]),
          jobDescription: shortText(10000),
        })
      )
      .mutation(({ ctx, input }) =>
        runAi(ctx, () => matchJobDescription(input))
      ),
    studyPlan: protectedProcedure
      .input(
        z.object({
          course: shortText(120),
          role: shortText(160),
          weakSkills: z.array(shortText(100)).max(30),
          days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
          language,
          context: z.string().max(1500).optional(),
        })
      )
      .mutation(({ ctx, input }) => runAi(ctx, () => generateStudyPlan(input))),
    explain: protectedProcedure
      .input(
        z.object({
          question: shortText(2000),
          course: shortText(120),
          level: shortText(80),
          language,
        })
      )
      .mutation(({ ctx, input }) => runAi(ctx, () => explainQuestion(input))),
    analyzeInterview: protectedProcedure
      .input(
        z.object({
          course: shortText(120),
          role: shortText(160),
          answers: z
            .array(
              z.object({
                question: shortText(2000),
                answer: shortText(12000),
                score: z.number().int().min(0).max(100),
              })
            )
            .min(1)
            .max(12),
        })
      )
      .mutation(({ ctx, input }) => runAi(ctx, () => analyzeInterview(input))),
  }),
  voice: router({
    transcribeStoredAudio: protectedProcedure
      .input(
        z.object({
          audioBase64: z
            .string()
            .min(1)
            .max(MAX_TRANSCRIPTION_AUDIO_BASE64_CHARS)
            .regex(
              /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
            ),
          mimeType: z.string().min(3).max(80),
          language: z.string().max(12).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return runAi(ctx, async () => {
          const result = await transcribeAudioBuffer({
            audioBuffer: Buffer.from(input.audioBase64, "base64"),
            mimeType: input.mimeType,
            language: input.language,
          });
          if ("error" in result)
            throw new TRPCError({
              code: "SERVICE_UNAVAILABLE",
              message: result.error,
            });
          return result;
        });
      }),
  }),
  behavioral: router({
    getEligibleQuestions: protectedProcedure.query(({ ctx }) =>
      getEligibleQuestions(ctx)
    ),
    getSession: protectedProcedure
      .input(z.object({ id: shortText(80) }))
      .query(({ ctx, input }) => getBehavioralSession(ctx, input.id)),
    createSession: protectedProcedure
      .input(
        z
          .object({
            selectedQuestions: z
              .array(
                z.object({
                  sourceSessionId: shortText(80),
                  sourceQuestionId: shortText(80),
                })
              )
              .max(20)
              .default([]),
            generatedQuestions: z
              .array(
                z.object({
                  question: shortText(2000),
                  topic: shortText(160),
                  difficulty: shortText(30),
                  rationale: z.string().max(500),
                })
              )
              .max(10)
              .default([]),
            includeAnswerEvaluation: z.boolean().default(true),
            consent: z.record(z.string(), z.unknown()).default({}),
            modelMetadata: z.record(z.string(), z.unknown()).default({}),
          })
          .refine(
            value =>
              value.selectedQuestions.length > 0 ||
              value.generatedQuestions.length > 0,
            {
              message: "Generate at least one behavioral question.",
              path: ["generatedQuestions"],
            }
          )
      )
      .mutation(({ ctx, input }) => createBehavioralSession(ctx, input)),
    saveAnswer: protectedProcedure
      .input(
        z.object({
          sessionId: shortText(80),
          questionId: shortText(80),
          transcript: z.string().trim().min(1).max(20000).nullable(),
          transcriptLanguage: z.string().max(20).nullable(),
          transcriptConfidence: z.number().min(0).max(1).nullable(),
          durationSeconds: z.number().gt(0).max(3600),
          startedAt: z.string().datetime(),
          endedAt: z.string().datetime(),
          observationSummary: z.record(z.string(), z.unknown()),
          observations: z
            .array(
              z.object({
                observedAtMs: z.number().int().min(0),
                observationType: shortText(80),
                payload: z.record(z.string(), z.unknown()),
                valid: z.boolean(),
                reliability: z.number().min(0).max(100).nullable(),
              })
            )
            .max(600),
        })
      )
      .mutation(({ ctx, input }) => saveBehavioralAnswer(ctx, input)),
    completeSession: protectedProcedure
      .input(z.object({ id: shortText(80) }))
      .mutation(({ ctx, input }) => completeBehavioralSession(ctx, input.id)),
    getReport: protectedProcedure
      .input(z.object({ id: shortText(80) }))
      .query(({ ctx, input }) => getBehavioralReport(ctx, input.id)),
  }),
  liveInterview: router({
    active: protectedProcedure.query(({ ctx }) => getActiveLiveSession(ctx)),
    recent: protectedProcedure.query(({ ctx }) => listLiveSessions(ctx)),
    create: protectedProcedure
      .input(
        z.object({
          role: shortText(160),
          durationMinutes: z.union([
            z.literal(5),
            z.literal(10),
            z.literal(15),
            z.literal(20),
            z.literal(30),
            z.literal(45),
            z.literal(60),
          ]),
          speechLanguage: z.string().min(2).max(20),
        })
      )
      .mutation(({ ctx, input }) => createLiveSession(ctx, input)),
    get: protectedProcedure
      .input(z.object({ id: shortText(80) }))
      .query(({ ctx, input }) => getLiveSession(ctx, input.id)),
    saveQuestion: protectedProcedure
      .input(
        z.object({
          sessionId: shortText(80),
          turnIndex: z.number().int().min(0).max(100),
          question: shortText(2000),
          type: shortText(80),
          difficulty: shortText(30),
          competencies: z.array(shortText(250)).max(20),
          parentTurnId: z.string().max(80).optional(),
          idempotencyKey: z.string().min(8).max(120),
        })
      )
      .mutation(({ ctx, input }) => saveLiveQuestion(ctx, input)),
    saveTranscript: protectedProcedure
      .input(
        z.object({
          sessionId: shortText(80),
          turnId: shortText(80),
          transcript: shortText(12000),
        })
      )
      .mutation(({ ctx, input }) => saveLiveTranscript(ctx, input)),
    saveCameraSummary: protectedProcedure
      .input(
        z.object({
          sessionId: shortText(80),
          summary: z
            .object({
              version: z.literal("local-framing-v1"),
              sample_count: z.number().int().min(1).max(10000),
              face_present: z.number().int().min(0).max(10000),
              shoulders_present: z.number().int().min(0).max(10000),
              hands_present: z.number().int().min(0).max(10000),
            })
            .strict(),
        })
      )
      .mutation(({ ctx, input }) => saveLiveCameraSummary(ctx, input)),
    evaluateTurn: protectedProcedure
      .input(z.object({ sessionId: shortText(80), turnId: shortText(80) }))
      .mutation(({ ctx, input }) => evaluateLiveTurn(ctx, input)),
    finalize: protectedProcedure
      .input(
        z.object({ id: shortText(80), reason: z.enum(["manual", "deadline"]) })
      )
      .mutation(({ ctx, input }) =>
        finalizeLiveSession(ctx, input.id, input.reason)
      ),
    forceEnd: protectedProcedure
      .input(z.object({ id: shortText(80) }))
      .mutation(({ ctx, input }) => forceEndLiveSession(ctx, input.id)),
  }),
  admin: router({
    access: adminProcedure.query(({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this admin route.",
        });
      }

      return {
        userId,
        allowed: true as const,
      };
    }),
    refreshQuestionBank: adminProcedure.mutation(async () => {
      try {
        return await invokeAdminQuestionRefresh(scheduledWorkAdapters);
      } catch {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message:
            "The question-bank refresh could not finish. Existing questions remain available; try again later.",
        });
      }
    }),
  }),
});
export type AppRouter = typeof appRouter;
