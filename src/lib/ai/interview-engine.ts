import { callLLMJson } from "./llm-client";

export interface InterviewOption {
  label: string;
  description: string;
  evidence: string; // industry context, companies using it, growth data
}

export interface InterviewQuestion {
  id: string;
  question: string;
  context: string; // scenario or situation framing
  options: InterviewOption[];
  category: "role" | "tech" | "domain" | "strength" | "learning_style" | "depth";
}

export interface InterviewState {
  answers: Record<string, string>; // question_id -> selected option label
  currentStep: number;
  characterContext?: string; // from user_character.md if available
}

const BASE_QUESTIONS: InterviewQuestion[] = [
  {
    id: "career_drive",
    question: "What energizes you most in your day-to-day engineering work?",
    context:
      "Understanding what drives you helps us find content that keeps you motivated, not just content that checks boxes.",
    options: [
      {
        label: "Solving hard technical puzzles",
        description: "You light up when facing a gnarly concurrency bug or an optimization challenge",
        evidence: "Engineers with this drive thrive at companies like Google, Jane Street, and infrastructure teams",
      },
      {
        label: "Building products people use",
        description: "Shipping features that users interact with gives you the biggest rush",
        evidence: "Product-focused engineers are in high demand at startups, Meta, Stripe, and growth-stage companies",
      },
      {
        label: "Designing elegant systems",
        description: "You care deeply about architecture, patterns, and how pieces fit together",
        evidence: "System designers are valued at Netflix, Uber, and any company operating at scale",
      },
      {
        label: "Leading and mentoring others",
        description: "Your impact multiplies when you help your team grow and make better decisions",
        evidence: "Engineering managers and tech leads are the fastest-growing role category, with 30% salary premium",
      },
    ],
    category: "role",
  },
  {
    id: "production_instinct",
    question: "It's 2 AM. Your monitoring dashboard just lit up red. What's your first move?",
    context:
      "This reveals your debugging instinct and where you naturally gravitate under pressure.",
    options: [
      {
        label: "Check the logs and traces",
        description: "You dive into observability tools -- logs, distributed traces, error rates",
        evidence: "Observability-first engineers are essential for microservices architectures (Datadog, Grafana, Honeycomb)",
      },
      {
        label: "Look at recent deployments",
        description: "You correlate with recent changes -- git log, deploy timeline, feature flags",
        evidence: "Change-correlation is the fastest path to resolution in 70% of incidents (Google SRE data)",
      },
      {
        label: "Check infrastructure metrics",
        description: "CPU, memory, network, disk -- you start from the bottom of the stack",
        evidence: "Infrastructure-first thinking is valued in platform engineering and SRE roles",
      },
      {
        label: "Communicate and coordinate",
        description: "You start a war room, notify stakeholders, and coordinate the response",
        evidence: "Incident commanders are rare and highly valued -- critical for staff+ engineering roles",
      },
    ],
    category: "strength",
  },
  {
    id: "learning_preference",
    question: "You need to learn a completely new technology stack in 3 weeks. How do you approach it?",
    context:
      "Your learning style determines what kind of content will actually stick for you.",
    options: [
      {
        label: "Build something immediately",
        description: "You learn by doing -- start a project, hit errors, Google them, repeat",
        evidence: "Project-based learners retain 75% more than passive learners (National Training Labs)",
      },
      {
        label: "Study the fundamentals first",
        description: "You read the docs, understand the architecture, then build with confidence",
        evidence: "Conceptual learners build deeper mental models -- common among senior engineers at FAANG",
      },
      {
        label: "Watch someone else do it",
        description: "Video tutorials, live coding streams, pair programming -- you learn by observation",
        evidence: "Visual learners benefit from YouTube channels like Fireship, ThePrimeagen, and conference talks",
      },
      {
        label: "Read code and reverse-engineer",
        description: "You clone repos, read source code, and understand how things actually work",
        evidence: "Code readers develop the deepest understanding -- valued in open source and platform teams",
      },
    ],
    category: "learning_style",
  },
];

/**
 * Generate adaptive follow-up questions based on previous answers and character doc.
 */
export async function generateAdaptiveQuestions(
  state: InterviewState,
  userId?: string
): Promise<InterviewQuestion[]> {
  const answersContext = Object.entries(state.answers)
    .map(([qId, answer]) => `- ${qId}: ${answer}`)
    .join("\n");

  const result = await callLLMJson<{ questions: InterviewQuestion[] }>(
    "adaptive_followup",
    [
      {
        role: "system",
        content: `You are an expert career coach and technical interviewer. Generate adaptive interview questions for a software engineer preparing for a job switch.

IMPORTANT RULES:
- Questions must be SCENARIO-BASED, not straightforward "pick a technology" style
- Each option must include real evidence: company names, industry data, growth trends
- Questions should help the user DISCOVER what they want, not just pick from a list
- If asking about technologies, frame it as "You're building X, which approach fits?" with pros/cons
- Each question must have exactly 4 options
- Return valid JSON matching the schema

Based on their previous answers, generate questions that probe deeper into their specific areas of interest.`,
      },
      {
        role: "user",
        content: `Previous answers:\n${answersContext}\n\n${
          state.characterContext
            ? `Character profile:\n${state.characterContext}\n\n`
            : ""
        }Generate 3 adaptive follow-up questions that dig deeper based on these answers. Focus on:
1. A technology/stack question framed as a scenario
2. A domain depth question (go deep vs go broad)
3. A career trajectory question

Return JSON: { "questions": [{ "id": string, "question": string, "context": string, "options": [{ "label": string, "description": string, "evidence": string }], "category": string }] }`,
      },
    ],
    { temperature: 0.8, userId }
  );

  return result.questions;
}

/**
 * Get the base interview questions (non-AI-generated).
 */
export function getBaseQuestions(): InterviewQuestion[] {
  return BASE_QUESTIONS;
}

/**
 * Analyze interview answers to extract a structured profile.
 */
export async function analyzeInterviewAnswers(
  answers: Record<string, string>,
  characterContext?: string,
  userId?: string
): Promise<{
  suggested_role: string;
  suggested_tech_stack: string[];
  suggested_domains: string[];
  strengths: string[];
  weaknesses: string[];
  learning_style: string;
  summary: string;
}> {
  const answersStr = Object.entries(answers)
    .map(([q, a]) => `${q}: ${a}`)
    .join("\n");

  return callLLMJson("interview_questions", [
    {
      role: "system",
      content: `Analyze these interview answers from a software engineer and extract a structured career profile. Be specific and actionable. Return JSON.`,
    },
    {
      role: "user",
      content: `Interview answers:\n${answersStr}\n\n${
        characterContext ? `Character profile:\n${characterContext}\n\n` : ""
      }Return JSON: { "suggested_role": string, "suggested_tech_stack": [strings], "suggested_domains": [strings], "strengths": [strings], "weaknesses": [strings], "learning_style": string, "summary": string }`,
    },
  ], { userId });
}
