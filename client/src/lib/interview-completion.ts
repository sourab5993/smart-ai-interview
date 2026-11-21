import { notifyUser, notifyWeeklyProgress } from "@/lib/notifications";
import { completionAdjustedScore } from "@/lib/scoring";

type Evaluation = {
  overall_score: number;
  dimensions: {
    name: string;
    score: number;
    note?: string;
    evidence?: string;
    weight?: number;
    measure?: "answer-quality" | "communication";
  }[];
  strengths: string[];
  weaknesses: string[];
  missing_points: string[];
  better_answer: string;
  improvement_tip: string;
  source: "ai" | "baseline" | "unknown";
  modelVersion?: string;
  promptVersion?: string;
  rubricVersion?: string;
};
type Session = {
  id: string;
  owner_id: string;
  course: string;
  specialization: string;
  target_role: string;
  interview_type: string;
  difficulty: string;
  created_at: string;
};
type Question = { id: string; question_text: string };
type Answer = { question_id: string; answer_text: string };
type RubricCriterion = { name: string; description: string; weight: number };

type CompletionInput = {
  client: any;
  ownerId: string;
  session: Session;
  questions: Question[];
  answers: Answer[];
  evaluations: Record<string, Evaluation>;
  summarize: (input: {
    course: string;
    role: string;
    answers: { question: string; answer: string; score: number }[];
  }) => Promise<any>;
};

const average = (values: number[]) =>
  values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
const normalized = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Only decode rubric fields the authenticated user can already see; never evaluate raw notes as instructions. */
export function evaluationCriteriaFromContext(raw: string): RubricCriterion[] {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (!Array.isArray(parsed.evaluationCriteria)) return [];
    return parsed.evaluationCriteria
      .slice(0, 12)
      .filter(
        (item: any) =>
          item &&
          typeof item.name === "string" &&
          item.name.length <= 80 &&
          typeof item.description === "string" &&
          item.description.length <= 400 &&
          Number.isFinite(Number(item.weight)) &&
          Number(item.weight) >= 0 &&
          Number(item.weight) <= 100
      )
      .map((item: any) => ({
        name: item.name,
        description: item.description,
        weight: Number(item.weight),
      }));
  } catch {
    return [];
  }
}

/** Acquire the shared deadline-worker lease before writing any derived completion data. */
export async function persistInterviewCompletion(input: CompletionInput) {
  const { client, ownerId, session } = input;
  const { data: claimToken, error: claimError } = await client.rpc(
    "claim_interview_finalization",
    { p_session_kind: "simple", p_session_id: session.id }
  );
  if (claimError) throw claimError;
  if (
    typeof claimToken !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      claimToken
    )
  )
    throw new Error(
      "This interview is already being finalized or has been completed. Refresh the saved report before retrying."
    );

  try {
    return await persistInterviewCompletionClaimed(input, claimToken);
  } catch (error) {
    try {
      await client.rpc("release_interview_finalization", {
        p_session_kind: "simple",
        p_session_id: session.id,
        p_claim_token: claimToken,
        p_failure_message: "Simple Interview report persistence failed; retry allowed.",
      });
    } catch {
      // The lease expires automatically if the database is temporarily unreachable.
    }
    throw error;
  }
}

/**
 * All writes before the final status transition are retry-safe upserts. The shared claim
 * prevents the browser and scheduled worker from writing competing completion snapshots.
 */
async function persistInterviewCompletionClaimed(
  input: CompletionInput,
  claimToken: string
) {
  const { client, ownerId, session, questions, answers, evaluations } = input;
  const scored = Object.values(evaluations).filter(
    value =>
      value?.source === "ai" &&
      Number.isFinite(Number(value.overall_score)) &&
      Number(value.overall_score) >= 0 &&
      Number(value.overall_score) <= 100
  );
  const answerQuality = average(scored.map(value => value.overall_score));
  const score =
    answerQuality === null
      ? null
      : completionAdjustedScore(answerQuality, scored.length, questions.length);
  const savedAnswerCount = answers.filter(answer =>
    answer.answer_text.trim()
  ).length;
  const answersByQuestion = new Map(
    answers.map(answer => [answer.question_id, answer.answer_text])
  );
  const answerSet = questions
    .map(question => ({
      id: question.id,
      question: question.question_text.slice(0, 2000),
      answer: answersByQuestion.get(question.id) || "",
      score: evaluations[question.id]?.overall_score,
      source: evaluations[question.id]?.source,
    }))
    .filter(
      answer =>
        answer.answer.trim().length > 0 &&
        answer.source === "ai" &&
        Number.isFinite(Number(answer.score))
    )
    .map(answer => ({
      question: answer.question,
      answer: answer.answer,
      score: Number(answer.score),
    }));

  let analysis: any = {
    analysisSource: "transparent-baseline",
    modelVersion: null,
    promptVersion: null,
    analysisModelVersion: null,
    analysisPromptVersion: null,
    summary:
      score === null
        ? savedAnswerCount
          ? `${savedAnswerCount} responses were saved, but none has a supported AI evaluation. No score is available.`
          : "No answers were evaluated. No score is available."
        : `You evaluated ${scored.length} of ${questions.length} answers. Answer quality was ${answerQuality}/100, and the completion-adjusted session score was ${score}/100.`,
    strengths: scored.flatMap(evaluation => evaluation.strengths).slice(0, 4),
    weaknesses: scored.flatMap(evaluation => evaluation.weaknesses).slice(0, 4),
    communication_issues: scored
      .flatMap(evaluation => evaluation.dimensions)
      .filter(
        dimension =>
          dimension.measure === "communication" && dimension.score < 70
      )
      .slice(0, 4)
      .map(
        dimension =>
          `${dimension.name}: ${dimension.note || `${dimension.score}/100; make one point and support it with a concrete example.`}`
      ),
    repeated_mistakes: [],
    missing_concepts: scored
      .flatMap(evaluation => evaluation.missing_points)
      .slice(0, 4),
    next_steps:
      score === null
        ? [
            savedAnswerCount
              ? "Retry evaluation for the saved responses before reviewing a score."
              : "Answer at least one question to receive scored feedback.",
          ]
        : [
            "Review the feedback on your lowest-scoring answer.",
            "Practice one targeted question from a priority skill.",
          ],
  };
  if (answerSet.length) {
    try {
      const generatedAnalysis = await input.summarize({
        course: session.course,
        role: session.target_role,
        answers: answerSet.slice(0, 12),
      });
      analysis = {
        ...generatedAnalysis,
        analysisSource: "ai",
        analysisModelVersion: generatedAnalysis.modelVersion ?? null,
        analysisPromptVersion: generatedAnalysis.promptVersion ?? null,
      };
    } catch {
      // Do not save a misleading heuristic report when AI analysis is unavailable.
      throw new Error("AI report analysis is unavailable. Please retry.");
    }
  }

  const dimensionValues = new Map<string, number[]>();
  for (const evaluation of scored)
    for (const dimension of evaluation.dimensions || []) {
      const name = dimension.name.trim().slice(0, 80);
      if (!name) continue;
      dimensionValues.set(name, [
        ...(dimensionValues.get(name) || []),
        Math.max(0, Math.min(100, Number(dimension.score) || 0)),
      ]);
    }
  const dimensionRecords = Array.from(dimensionValues.entries()).map(
    ([name, values]) => ({
      owner_id: ownerId,
      session_id: session.id,
      metric_name: name,
      metric_value: average(values) ?? 0,
      category: name,
    })
  );
  if (dimensionRecords.length) {
    const { error } = await client
      .from("performance_metrics")
      .upsert(dimensionRecords, {
        onConflict: "owner_id,session_id,metric_name",
      });
    if (error) throw error;
  }

  const { data: history, error: historyError } = await client
    .from("interview_sessions")
    .select("id,course,target_role,overall_score,created_at,difficulty,status")
    .eq("owner_id", ownerId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(150);
  if (historyError) throw historyError;
  const matchingHistory = (history || []).filter(
    (row: any) =>
      row.course === session.course && row.target_role === session.target_role
  );
  const sessionIds = [
    session.id,
    ...matchingHistory.map((row: any) => row.id),
  ].slice(0, 151);
  const { data: historicalMetrics, error: historicalMetricError } = await client
    .from("performance_metrics")
    .select("session_id,metric_name,metric_value")
    .eq("owner_id", ownerId)
    .in("session_id", sessionIds)
    .limit(1500);
  if (historicalMetricError) throw historicalMetricError;

  const metricGroups = new Map<string, number[]>();
  for (const row of historicalMetrics || []) {
    const name = String(row.metric_name || "").trim();
    if (name)
      metricGroups.set(name, [
        ...(metricGroups.get(name) || []),
        Number(row.metric_value),
      ]);
  }
  const currentDimensions = Array.from(metricGroups.entries()).map(
    ([name, values]) => ({ name, score: average(values) ?? 0 })
  );

  const { data: role, error: roleError } = await client
    .from("job_roles")
    .select("id")
    .eq("name", session.target_role)
    .eq("active", true)
    .maybeSingle();
  if (roleError) throw roleError;
  let requirements: any[] = [];
  if (role?.id) {
    const { data, error } = await client
      .from("role_skills")
      .select("skill_id,required_score,skill:skills(name)")
      .eq("role_id", role.id)
      .eq("active", true)
      .limit(100);
    if (error) throw error;
    requirements = data || [];
  }
  const gaps = new Map<string, any>();
  for (const dimension of currentDimensions) {
    const key = normalized(dimension.name);
    const matched = requirements.find(row => {
      const skillName = String(row.skill?.name || "");
      const skill = normalized(skillName);
      return (
        skill &&
        (skill === key ||
          (skill.length >= 5 && key.includes(skill)) ||
          (key.length >= 5 && skill.includes(key)))
      );
    });
    const skillName = String(matched?.skill?.name || dimension.name).slice(
      0,
      160
    );
    const required = Number(matched?.required_score) || 75;
    const gap = Math.max(0, required - dimension.score);
    gaps.set(skillName, {
      owner_id: ownerId,
      skill_id: matched?.skill_id || null,
      skill_name: skillName,
      course: session.course,
      target_role: session.target_role,
      current_score: dimension.score,
      required_score: required,
      priority: gap >= 20 ? "High" : gap >= 10 ? "Medium" : "Low",
      updated_at: new Date().toISOString(),
    });
  }
  const gapRecords = Array.from(gaps.values());
  if (gapRecords.length) {
    const { error } = await client.from("skill_gaps").upsert(gapRecords, {
      onConflict: "owner_id,course,target_role,skill_name",
    });
    if (error) throw error;
  }

  const previousScores = matchingHistory
    .map((row: any) => Number(row.overall_score))
    .filter((value: number) => Number.isFinite(value));
  const readiness =
    score === null
      ? null
      : (average([...previousScores.slice(0, 9), score]) ?? score);
  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const frequency30d =
    matchingHistory.filter(
      (row: any) => new Date(row.created_at).getTime() >= recentCutoff
    ).length + 1;
  const metricAverage = (pattern: RegExp) =>
    average(
      currentDimensions
        .filter(row => pattern.test(row.name))
        .map(row => row.score)
    );
  const questionDifficulty =
    ({ Easy: 1, Medium: 2, Hard: 3, Expert: 4 } as Record<string, number>)[
      session.difficulty
    ] || 2;
  const completionRate = questions.length
    ? Math.round((100 * scored.length) / questions.length)
    : 0;
  const weakAreas = currentDimensions
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map(row => ({ skill: row.name, average_score: row.score }));
  const readinessLabel =
    readiness === null
      ? null
      : readiness >= 85
        ? "Highly Ready"
        : readiness >= 72
          ? "Interview Ready"
          : readiness >= 55
            ? "Improving"
            : "Needs Preparation";
  if (score !== null && readiness !== null) {
    const prediction = {
      owner_id: ownerId,
      session_id: session.id,
      readiness_score: readiness,
      readiness_label: readinessLabel,
      features: {
        historical_average_score: readiness,
        recent_average_score:
          average(previousScores.slice(0, 5).concat(score)) ?? score,
        technical_score: metricAverage(
          /technical|domain knowledge|accuracy|accounting|clinical|legal knowledge/i
        ),
        communication_score: metricAverage(
          /communication|clarity|fluency|grammar|professionalism/i
        ),
        problem_solving_score: metricAverage(
          /problem|reasoning|analysis|decision|application|case/i
        ),
        question_difficulty: session.difficulty,
        question_difficulty_level: questionDifficulty,
        correctness_score: metricAverage(
          /correctness|accuracy|logic|code quality/i
        ),
        completion_rate: completionRate,
        answered_questions: scored.length,
        question_count: questions.length,
        interview_frequency_30d: frequency30d,
        skill_gaps: gapRecords.length,
        weak_areas: weakAreas,
        course: session.course,
        target_role: session.target_role,
        method:
          "Transparent rolling average of actual completed interview scores; difficulty and completion features are descriptive, not a trained model.",
      },
      model_type: "transparent-baseline",
      model_version: "baseline-v1",
    };
    const { error: predictionError } = await client
      .from("ml_predictions")
      .upsert(prediction, { onConflict: "owner_id,session_id" });
    if (predictionError) throw predictionError;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000)
  );
  const { data: completed, error: completionError } = await client.rpc(
    "complete_simple_interview_with_claim",
    {
      p_session_id: session.id,
      p_claim_token: claimToken,
      p_overall_score: score,
      p_report: analysis,
    }
  );
  if (completionError) throw completionError;
  if (completed !== true)
    throw new Error(
      "The finalization lease or session status changed before the report was saved. Refresh to check the latest session state."
    );

  void notifyUser(
    ownerId,
    "interview_completed",
    "Interview completed",
    `Your ${session.target_role} practice report is ready.`
  );
  void notifyUser(
    ownerId,
    "report_ready",
    "Your practice report is ready",
    score === null
      ? "Your responses were saved, but no supported AI evaluation was available; no score is shown."
      : `${score}/100 overall from your saved answers. Review the report for course-specific feedback.`
  );
  if (gapRecords.length)
    void notifyUser(
      ownerId,
      "skill_gap_updated",
      "Your practice priorities were updated",
      `${gapRecords.length} course- and role-linked dimension${gapRecords.length === 1 ? "" : "s"} now have saved learning targets.`
    );
  if (dimensionRecords.length)
    void notifyUser(
      ownerId,
      "recommended_practice",
      "A focused next step is ready",
      "Review your lowest-scoring evaluated dimension and use it to guide your next practice session."
    );
  if (score !== null) void notifyWeeklyProgress(ownerId);

  return {
    score,
    readiness,
    analysis,
    elapsedSeconds,
    dimensionCount: dimensionRecords.length,
    skillGapCount: gapRecords.length,
  };
}
