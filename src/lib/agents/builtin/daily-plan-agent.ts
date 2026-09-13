import type { AgentDefinition, AgentContext, DataView, ListItem } from "../types";
import { registerAgent } from "../registry";

interface PlanItem {
  id: string;
  title: string;
  content_type: string;
  url: string;
  estimated_minutes: number;
  topic: string;
  status: "pending" | "completed" | "skipped";
}

interface DailyPlanState {
  date: string;
  items: PlanItem[];
  reasoning: string;
}

const DAILY_PLAN_SYSTEM = `You are a learning plan optimizer. Create a daily learning plan for a software engineer based on their available time and pending content items.

Rules:
1. Respect the user's available daily hours
2. Mix content types (don't assign all videos or all blogs)
3. Start with shorter/easier items for momentum
4. Prioritize higher priority items
5. Return valid JSON`;

const dailyPlanAgent: AgentDefinition = {
  identity: {
    slug: "daily-plan",
    name: "Daily Plan",
    description: "Generates a personalized daily learning plan from your content library, mixing content types and respecting your available time.",
    version: "1.0.0",
    author: "system",
    category: "builtin",
    icon: "Calendar",
    color: "green",
  },

  configFields: [
    { key: "auto_generate", label: "Auto-generate daily", type: "boolean", default: true },
  ],

  permissions: [
    { resource: "profiles", actions: ["read"] },
    { resource: "content_items", actions: ["read", "write"] },
  ],

  tools: [],
  mcpConnections: [],
  dataViewType: "list",
  defaultExecutionMode: "on_demand",
  defaultSchedule: "0 7 * * *",

  async validate() {
    return { valid: true };
  },

  async execute(ctx: AgentContext): Promise<Record<string, unknown>> {
    const today = new Date().toISOString().split("T")[0];

    // Check for existing plan today
    const existingPlan = await ctx.storage.get<DailyPlanState>("plan_" + today);
    if (existingPlan) {
      return existingPlan as unknown as Record<string, unknown>;
    }

    const profile = await ctx.db.getProfile();
    const dailyMinutes = ((profile?.daily_hours_available as number) || 2) * 60;

    // Get pending content items
    const pendingItemsRaw = await ctx.db.query("content_items", { status: "pending" });
    const pendingItems = pendingItemsRaw as Record<string, unknown>[];

    if (pendingItems.length === 0) {
      const emptyPlan: DailyPlanState = { date: today, items: [], reasoning: "No pending content items. Run Content Discovery first." };
      await ctx.storage.set("plan_" + today, emptyPlan, 86400);
      return emptyPlan as unknown as Record<string, unknown>;
    }

    // Use LLM to select items
    const itemsForLLM = pendingItems.slice(0, 20).map((i) => ({
      id: i.id,
      title: i.title,
      type: i.content_type,
      minutes: i.estimated_minutes,
      priority: i.priority,
      topic: i.topic,
    }));

    const result = await ctx.llm.chatJson<{ selected_ids: string[]; reasoning: string }>(
      [
        { role: "system", content: DAILY_PLAN_SYSTEM },
        {
          role: "user",
          content: `Available time: ${dailyMinutes} minutes\n\nPending items:\n${JSON.stringify(itemsForLLM, null, 2)}\n\nSelect items for today. Return JSON: { "selected_ids": [item_ids], "reasoning": "brief explanation" }`,
        },
      ]
    );

    // Build plan items
    const selectedItems: PlanItem[] = result.selected_ids
      .map((id: string) => {
        const item = pendingItems.find((i) => i.id === id);
        if (!item) return null;
        return {
          id: item.id as string,
          title: item.title as string,
          content_type: item.content_type as string,
          url: item.url as string,
          estimated_minutes: item.estimated_minutes as number,
          topic: item.topic as string,
          status: "pending" as const,
        };
      })
      .filter(Boolean) as PlanItem[];

    const plan: DailyPlanState = {
      date: today,
      items: selectedItems,
      reasoning: result.reasoning,
    };

    await ctx.storage.set("plan_" + today, plan, 86400);
    return plan as unknown as Record<string, unknown>;
  },

  async render(data: Record<string, unknown>): Promise<DataView<"list">> {
    const plan = data as unknown as DailyPlanState;

    const items: ListItem[] = plan.items.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: `${item.topic} — ~${item.estimated_minutes} min`,
      status: item.status,
      badge: {
        text: item.content_type,
        variant: item.status === "completed" ? "success" as const : "default" as const,
      },
      url: item.url,
      actions: [
        { label: "Done", type: "primary" as const, handler: "mark_done", params: { itemId: item.id } },
        { label: "Skip", type: "secondary" as const, handler: "skip", params: { itemId: item.id } },
      ],
    }));

    const completed = plan.items.filter((i) => i.status === "completed").length;
    const total = plan.items.length;

    return {
      type: "list",
      title: "Today's Plan",
      subtitle: total > 0 ? `${completed}/${total} completed` : "No items",
      data: { items },
      actions: [
        { label: "Regenerate", type: "secondary", handler: "regenerate" },
      ],
      empty_state: {
        title: "No plan for today",
        description: "Generate a plan or run Content Discovery first to build your content library.",
        action: { label: "Generate Plan", type: "primary", handler: "regenerate" },
      },
      updated_at: new Date().toISOString(),
    };
  },

  async handleAction(actionId: string, params: Record<string, unknown>, ctx: AgentContext) {
    const today = new Date().toISOString().split("T")[0];
    const plan = await ctx.storage.get<DailyPlanState>("plan_" + today);

    if (actionId === "mark_done" && plan) {
      const itemId = params.itemId as string;
      plan.items = plan.items.map((i) =>
        i.id === itemId ? { ...i, status: "completed" as const } : i
      );
      await ctx.storage.set("plan_" + today, plan, 86400);
      return dailyPlanAgent.render(plan as unknown as Record<string, unknown>, ctx);
    }

    if (actionId === "skip" && plan) {
      const itemId = params.itemId as string;
      plan.items = plan.items.map((i) =>
        i.id === itemId ? { ...i, status: "skipped" as const } : i
      );
      await ctx.storage.set("plan_" + today, plan, 86400);
      return dailyPlanAgent.render(plan as unknown as Record<string, unknown>, ctx);
    }

    if (actionId === "regenerate") {
      await ctx.storage.delete("plan_" + today);
      const newData = await dailyPlanAgent.execute(ctx);
      return dailyPlanAgent.render(newData, ctx);
    }
  },
};

registerAgent(dailyPlanAgent);
