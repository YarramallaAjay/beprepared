import type { AgentDefinition, AgentContext, DataView, ConversationMessage, ConversationOption } from "../types";
import { registerAgent } from "../registry";

interface InterviewOption {
  label: string;
  description: string;
  evidence: string;
}

interface InterviewQuestion {
  id: string;
  question: string;
  context: string;
  options: InterviewOption[];
  category: string;
}

interface InterviewState {
  phase: "base" | "adaptive" | "analyzing" | "complete";
  baseQuestions: InterviewQuestion[];
  adaptiveQuestions: InterviewQuestion[];
  answers: Record<string, string>;
  analysis?: Record<string, unknown>;
}

const BASE_QUESTIONS: InterviewQuestion[] = [
  {
    id: "career_drive",
    question: "What energizes you most in your day-to-day engineering work?",
    context: "Understanding what drives you helps us find content that keeps you motivated.",
    options: [
      { label: "Solving hard technical puzzles", description: "You light up when facing a gnarly concurrency bug or optimization challenge", evidence: "Engineers with this drive thrive at Google, Jane Street, and infrastructure teams" },
      { label: "Building products people use", description: "Shipping features that users interact with gives you the biggest rush", evidence: "Product-focused engineers are in high demand at startups, Meta, Stripe" },
      { label: "Designing elegant systems", description: "You care deeply about architecture, patterns, and how pieces fit together", evidence: "System designers are valued at Netflix, Uber, and companies at scale" },
      { label: "Leading and mentoring others", description: "Your impact multiplies when you help your team grow", evidence: "Engineering managers and tech leads are the fastest-growing role category" },
    ],
    category: "role",
  },
  {
    id: "production_instinct",
    question: "It's 2 AM. Your monitoring dashboard just lit up red. What's your first move?",
    context: "This reveals your debugging instinct and where you naturally gravitate under pressure.",
    options: [
      { label: "Check the logs and traces", description: "You dive into observability tools — logs, distributed traces, error rates", evidence: "Observability-first engineers are essential for microservices architectures" },
      { label: "Look at recent deployments", description: "You correlate with recent changes — git log, deploy timeline, feature flags", evidence: "Change-correlation is the fastest path to resolution in 70% of incidents" },
      { label: "Check infrastructure metrics", description: "CPU, memory, network, disk — you start from the bottom of the stack", evidence: "Infrastructure-first thinking is valued in platform engineering and SRE roles" },
      { label: "Communicate and coordinate", description: "You start a war room, notify stakeholders, and coordinate the response", evidence: "Incident commanders are rare and highly valued for staff+ roles" },
    ],
    category: "strength",
  },
  {
    id: "learning_preference",
    question: "You need to learn a completely new technology stack in 3 weeks. How do you approach it?",
    context: "Your learning style determines what kind of content will actually stick for you.",
    options: [
      { label: "Build something immediately", description: "You learn by doing — start a project, hit errors, Google them, repeat", evidence: "Project-based learners retain 75% more than passive learners" },
      { label: "Study the fundamentals first", description: "You read the docs, understand the architecture, then build with confidence", evidence: "Conceptual learners build deeper mental models — common among senior engineers" },
      { label: "Watch someone else do it", description: "Video tutorials, live coding streams, pair programming — you learn by observation", evidence: "Visual learners benefit from YouTube channels like Fireship, ThePrimeagen" },
      { label: "Read code and reverse-engineer", description: "You clone repos, read source code, and understand how things actually work", evidence: "Code readers develop the deepest understanding — valued in open source" },
    ],
    category: "learning_style",
  },
];

const interviewAgent: AgentDefinition = {
  identity: {
    slug: "interview",
    name: "Career Interview",
    description: "Interactive interview that discovers your career goals, tech preferences, and learning style to personalize all other agents.",
    version: "1.0.0",
    author: "system",
    category: "builtin",
    icon: "MessageSquare",
    color: "emerald",
  },

  configFields: [
    { key: "adaptive_count", label: "Adaptive follow-up questions", type: "number", default: 3, validation: { min: 1, max: 5 } },
  ],

  permissions: [
    { resource: "profiles", actions: ["read", "write"] },
    { resource: "character_documents", actions: ["read"] },
  ],

  tools: [],
  mcpConnections: [],
  dataViewType: "conversation",
  defaultExecutionMode: "on_demand",

  async validate() {
    return { valid: true };
  },

  async execute(ctx: AgentContext): Promise<Record<string, unknown>> {
    // Load or initialize state
    let state = await ctx.storage.get<InterviewState>("interview_state");

    if (!state) {
      state = {
        phase: "base",
        baseQuestions: BASE_QUESTIONS,
        adaptiveQuestions: [],
        answers: {},
      };
      await ctx.storage.set("interview_state", state);
    }

    // If we have all base answers but no adaptive questions, generate them
    if (
      state.phase === "base" &&
      Object.keys(state.answers).length >= BASE_QUESTIONS.length
    ) {
      state.phase = "adaptive";
      const adaptiveCount = (ctx.userConfig.adaptive_count as number) || 3;

      const answersContext = Object.entries(state.answers)
        .map(([q, a]) => `- ${q}: ${a}`)
        .join("\n");

      const charDoc = await ctx.db.getCharacterDoc();

      const result = await ctx.llm.chatJson<{ questions: InterviewQuestion[] }>(
        [
          {
            role: "system",
            content: `Generate ${adaptiveCount} adaptive interview questions for a software engineer. Each must have 4 scenario-based options with real evidence. Return JSON: { "questions": [...] }`,
          },
          {
            role: "user",
            content: `Previous answers:\n${answersContext}\n\n${charDoc ? `Character profile:\n${charDoc}\n\n` : ""}Generate ${adaptiveCount} adaptive follow-up questions.`,
          },
        ],
        { temperature: 0.8 }
      );

      state.adaptiveQuestions = result.questions;
      await ctx.storage.set("interview_state", state);
    }

    // If all questions answered, analyze
    const totalQuestions = BASE_QUESTIONS.length + state.adaptiveQuestions.length;
    if (
      state.phase === "adaptive" &&
      Object.keys(state.answers).length >= totalQuestions
    ) {
      state.phase = "analyzing";

      const answersStr = Object.entries(state.answers)
        .map(([q, a]) => `${q}: ${a}`)
        .join("\n");

      const analysis = await ctx.llm.chatJson<Record<string, unknown>>(
        [
          {
            role: "system",
            content: "Analyze these interview answers and extract a structured career profile. Return JSON.",
          },
          {
            role: "user",
            content: `Interview answers:\n${answersStr}\n\nReturn JSON: { "suggested_role": string, "suggested_tech_stack": [strings], "suggested_domains": [strings], "strengths": [strings], "weaknesses": [strings], "learning_style": string, "summary": string }`,
          },
        ]
      );

      state.analysis = analysis;
      state.phase = "complete";
      await ctx.storage.set("interview_state", state);
    }

    return state as unknown as Record<string, unknown>;
  },

  async render(data: Record<string, unknown>): Promise<DataView<"conversation">> {
    const state = data as unknown as InterviewState;
    const messages: ConversationMessage[] = [];

    const allQuestions = [...state.baseQuestions, ...state.adaptiveQuestions];
    const answeredCount = Object.keys(state.answers).length;

    // Find the first unanswered question
    const currentQuestionId = allQuestions.find((q) => !state.answers[q.id])?.id;

    for (const q of allQuestions) {
      const isAnswered = !!state.answers[q.id];
      const isCurrent = q.id === currentQuestionId;

      // Build structured options only for the current unanswered question
      const options: ConversationOption[] | undefined = isCurrent
        ? q.options.map((o) => ({
            id: q.id,
            label: o.label,
            description: o.description,
          }))
        : undefined;

      messages.push({
        id: q.id,
        role: "assistant",
        content: `**${q.question}**\n\n_${q.context}_`,
        timestamp: new Date().toISOString(),
        options,
        metadata: { category: q.category },
      });

      if (isAnswered) {
        messages.push({
          id: `answer-${q.id}`,
          role: "user",
          content: state.answers[q.id],
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Analysis result
    if (state.analysis) {
      const analysis = state.analysis as {
        summary?: string;
        suggested_role?: string;
        strengths?: string[];
        learning_style?: string;
      };
      const parts: string[] = ["**Your Profile is Ready!**"];
      if (analysis.summary) parts.push(analysis.summary);
      if (analysis.suggested_role) parts.push(`\n**Suggested Role:** ${analysis.suggested_role}`);
      if (analysis.strengths?.length) parts.push(`**Strengths:** ${analysis.strengths.join(", ")}`);
      if (analysis.learning_style) parts.push(`**Learning Style:** ${analysis.learning_style}`);

      messages.push({
        id: "analysis",
        role: "assistant",
        content: parts.join("\n\n"),
        timestamp: new Date().toISOString(),
        metadata: { type: "analysis" },
      });
    }

    const totalCount = allQuestions.length || BASE_QUESTIONS.length;
    const isComplete = state.phase === "complete";

    return {
      type: "conversation",
      title: "Career Interview",
      subtitle: isComplete
        ? "Interview complete — your profile is ready"
        : `Question ${answeredCount + 1} of ${totalCount}`,
      data: {
        messages,
        input_placeholder: isComplete ? undefined : "Tap an option to answer",
        interactive: !isComplete,
      },
      actions: isComplete
        ? [
            { label: "View Profile", type: "primary", handler: "view_profile" },
            { label: "Restart", type: "secondary", handler: "restart" },
          ]
        : undefined,
      metadata: isComplete ? { phase: "complete", nextAgent: "character" } : { phase: state.phase },
      updated_at: new Date().toISOString(),
    };
  },

  async handleAction(actionId: string, params: Record<string, unknown>, ctx: AgentContext) {
    if (actionId === "select_option") {
      const state = await ctx.storage.get<InterviewState>("interview_state");
      if (!state) return;

      const questionId = params.questionId as string;
      const answer = params.answer as string;
      state.answers[questionId] = answer;
      await ctx.storage.set("interview_state", state);

      // Re-execute to advance state
      const newData = await interviewAgent.execute(ctx);
      return interviewAgent.render(newData, ctx);
    }

    if (actionId === "restart") {
      await ctx.storage.delete("interview_state");
      const newData = await interviewAgent.execute(ctx);
      return interviewAgent.render(newData, ctx);
    }
  },
};

registerAgent(interviewAgent);
