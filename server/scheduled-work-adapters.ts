import {
  AI_MODEL,
  analyzeInterview,
  evaluateAnswer,
  generateQuestions,
} from "./ai";
import type { GeneratedBankQuestion, WorkAdapters } from "./scheduled-work";

const DOMAINS = [
  {
    courseCategory: "engineering",
    categoryLabel: "Engineering & Technology",
    course: "B.Tech Computer Science and Engineering",
    role: "Software Engineer",
    skills: ["data structures", "API design", "testing"],
  },
  {
    courseCategory: "engineering",
    categoryLabel: "Engineering & Technology",
    course: "B.Tech Mechanical Engineering",
    role: "Mechanical Design Engineer",
    skills: ["machine design", "materials", "manufacturing"],
  },
  {
    courseCategory: "medical",
    categoryLabel: "Medical & Healthcare",
    course: "B.Sc Nursing",
    role: "Staff Nurse",
    skills: ["patient safety", "clinical communication", "care planning"],
  },
  {
    courseCategory: "medical",
    categoryLabel: "Medical & Healthcare",
    course: "B.Pharm",
    role: "Pharmacovigilance Associate",
    skills: ["medicine safety", "adverse event reporting", "documentation"],
  },
  {
    courseCategory: "commerce",
    categoryLabel: "Commerce",
    course: "B.Com",
    role: "Financial Analyst",
    skills: ["financial statements", "accounting", "variance analysis"],
  },
  {
    courseCategory: "management",
    categoryLabel: "Management & Business",
    course: "MBA Marketing",
    role: "Marketing Executive",
    skills: ["customer research", "campaign planning", "measurement"],
  },
  {
    courseCategory: "science",
    categoryLabel: "Science",
    course: "B.Sc Biology",
    role: "Research Assistant",
    skills: ["experimental design", "lab safety", "data interpretation"],
  },
  {
    courseCategory: "law",
    categoryLabel: "Law",
    course: "LLB",
    role: "Legal Associate",
    skills: ["case analysis", "legal research", "argument structure"],
  },
  {
    courseCategory: "arts",
    categoryLabel: "Arts & Humanities",
    course: "BA English",
    role: "Content Writer",
    skills: ["editing", "audience analysis", "clear communication"],
  },
  {
    courseCategory: "design",
    categoryLabel: "Design & Creative",
    course: "UI/UX Design",
    role: "Product Designer",
    skills: ["user research", "prototyping", "accessibility"],
  },
  {
    courseCategory: "education",
    categoryLabel: "Education",
    course: "B.Ed",
    role: "Teacher",
    skills: ["lesson planning", "assessment", "inclusive teaching"],
  },
  {
    courseCategory: "hospitality",
    categoryLabel: "Hospitality & Tourism",
    course: "Hospitality Management",
    role: "Hospitality Manager",
    skills: ["guest service", "operations", "service recovery"],
  },
  {
    courseCategory: "agriculture",
    categoryLabel: "Agriculture",
    course: "B.Sc Agriculture",
    role: "Agriculture Officer",
    skills: ["soil and water management", "farm systems", "sustainability"],
  },
  {
    courseCategory: "vocational",
    categoryLabel: "Vocational & Diploma",
    course: "Industrial Trades",
    role: "Engineering Technician",
    skills: ["equipment safety", "fault diagnosis", "maintenance"],
  },
  {
    courseCategory: "science",
    categoryLabel: "Science",
    course: "B.Sc Statistics",
    role: "Data Analyst",
    skills: ["data quality", "statistical reasoning", "visualization"],
  },
] as const;

function questionCategoryForDifficulty(difficulty: string) {
  switch (difficulty) {
    case "Easy":
      return "Basic";
    case "Medium":
      return "Application-based";
    case "Hard":
      return "Scenario-based";
    default:
      throw new Error("AI returned an unsupported question difficulty.");
  }
}

export const scheduledWorkAdapters: WorkAdapters = {
  generateQuestions: async ({
    count,
    model,
  }): Promise<GeneratedBankQuestion[]> => {
    if (model !== AI_MODEL) {
      throw new Error("Daily question refresh requested an unsupported model.");
    }
    if (!Number.isInteger(count) || count < 6 || count > 60) {
      throw new Error(
        "Daily question refresh count is outside its safe bound."
      );
    }

    const domains = DOMAINS.slice(0, Math.min(count, DOMAINS.length));
    const base = Math.floor(count / domains.length);
    const remainder = count % domains.length;
    const targetCounts = domains.map(
      (_, index) => base + Number(index < remainder)
    );
    const difficultyLevels = ["Easy", "Medium", "Hard"] as const;
    let difficultyCursor = 0;
    const difficultyPlans = targetCounts.map(targetCount =>
      Array.from({ length: targetCount }, () => {
        const difficulty =
          difficultyLevels[difficultyCursor % difficultyLevels.length];
        difficultyCursor += 1;
        return difficulty;
      })
    );
    const questions: GeneratedBankQuestion[] = [];

    // Bound concurrent provider requests while keeping the daily job finite.
    for (let offset = 0; offset < domains.length; offset += 3) {
      const batch = await Promise.all(
        domains.slice(offset, offset + 3).map(async (domain, localIndex) => {
          const domainIndex = offset + localIndex;
          const targetCount = targetCounts[domainIndex];
          const difficultyOrder = difficultyPlans[domainIndex];
          const result = await generateQuestions({
            course: domain.course,
            role: domain.role,
            type: "Domain",
            difficulty: targetCount === 1 ? difficultyOrder[0] : "Mixed",
            skills: [...domain.skills],
            count: targetCount,
            language: "English",
            context: [
              "This is an unattended daily question-bank refresh; generate original interviewer-ready questions, not answers or candidate-specific claims.",
              `Course family slug: ${domain.courseCategory}. Display label: ${domain.categoryLabel}. Course: ${domain.course}. Role: ${domain.role}.`,
              `Return exactly ${targetCount} distinct questions. Requested difficulty labels in order: ${difficultyOrder.join(", ")}. Use only Easy, Medium, or Hard, with the requested sequence.`,
              "Keep every prompt accurate to the course and role, concise, usable without a resume, and clearly distinct from the others. Do not make non-IT questions about programming.",
            ].join(" "),
          });

          if (
            result.source !== "ai" ||
            result.questions.length !== targetCount
          ) {
            throw new Error(
              "AI did not return the requested structured batch."
            );
          }

          return result.questions.map(question => ({
            question: question.question,
            topic: question.topic || domain.categoryLabel,
            difficulty: question.difficulty,
            rationale: question.rationale,
            category: domain.courseCategory,
            questionCategory: questionCategoryForDifficulty(
              question.difficulty
            ),
            interviewType: "Domain",
            course: domain.course,
            role: domain.role,
          }));
        })
      );
      questions.push(...batch.flat());
    }

    return questions;
  },
  evaluate: evaluateAnswer,
  analyze: analyzeInterview,
};
