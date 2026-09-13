import type { AgentDefinition, AgentContext, DataView, NotificationItem } from "../types";
import { registerAgent } from "../registry";

const WHATSAPP_PARSING_PROMPT = `Parse the user's WhatsApp message and determine their intent. Return JSON with:
- intent: "mark_done" | "skip" | "next" | "status" | "help" | "unknown"
- item_reference: number or null
- message: a friendly response to send back

Be forgiving with parsing - "done", "finished", "completed" all mean mark_done.
"skip", "later", "nah" mean skip. "next", "?" mean next.
"how am I doing", "progress", "status" mean status.`;

interface WhatsAppMessage {
  id: string;
  direction: "incoming" | "outgoing";
  content: string;
  timestamp: string;
  intent?: string;
}

const whatsappAgent: AgentDefinition = {
  identity: {
    slug: "whatsapp",
    name: "WhatsApp Assistant",
    description: "Manages your learning through WhatsApp. Send 'done', 'skip', 'next', or 'status' to interact with your daily plan.",
    version: "1.0.0",
    author: "system",
    category: "builtin",
    icon: "MessageCircle",
    color: "green",
  },

  configFields: [
    { key: "phone_number", label: "Phone number", type: "string", required: true, description: "WhatsApp number with country code" },
    { key: "morning_time", label: "Morning reminder time", type: "string", default: "08:00" },
    { key: "evening_time", label: "Evening reminder time", type: "string", default: "20:00" },
    { key: "timezone", label: "Timezone", type: "string", default: "Asia/Kolkata" },
    { key: "enabled", label: "Reminders enabled", type: "boolean", default: true },
  ],

  permissions: [
    { resource: "profiles", actions: ["read"] },
    { resource: "reminders", actions: ["read", "write"] },
  ],

  tools: [],
  mcpConnections: [],
  dataViewType: "notifications",
  defaultExecutionMode: "event_triggered",
  defaultEventTriggers: ["whatsapp_message", "daily_morning", "daily_evening"],

  async validate(config) {
    if (!config.phone_number) {
      return { valid: false, errors: ["Phone number is required"] };
    }
    return { valid: true };
  },

  async execute(ctx: AgentContext): Promise<Record<string, unknown>> {
    // Load message history from storage
    const messages = await ctx.storage.get<WhatsAppMessage[]>("message_history") || [];

    // Get current reminder config
    const reminders = await ctx.db.query("reminders", { channel: "whatsapp" });

    return {
      messages: messages.slice(-20), // Last 20 messages
      reminder_config: reminders[0] || null,
      phone_number: ctx.userConfig.phone_number,
      enabled: ctx.userConfig.enabled,
    };
  },

  async render(data: Record<string, unknown>): Promise<DataView<"notifications">> {
    const messages = (data.messages as WhatsAppMessage[]) || [];
    const enabled = data.enabled as boolean;

    const items: NotificationItem[] = messages.map((msg) => ({
      id: msg.id,
      title: msg.direction === "incoming" ? "You" : "BePrepared",
      message: msg.content,
      level: msg.direction === "incoming" ? "info" as const : "success" as const,
      timestamp: msg.timestamp,
      read: true,
    }));

    return {
      type: "notifications",
      title: "WhatsApp Assistant",
      subtitle: enabled ? "Active" : "Paused",
      data: {
        items,
        unread_count: 0,
      },
      actions: [
        {
          label: enabled ? "Pause Reminders" : "Enable Reminders",
          type: "secondary",
          handler: "toggle_reminders",
        },
      ],
      empty_state: {
        title: "No messages yet",
        description: "Configure your phone number and send a message to get started.",
      },
      updated_at: new Date().toISOString(),
    };
  },

  async handleAction(actionId: string, params: Record<string, unknown>, ctx: AgentContext) {
    if (actionId === "process_message") {
      const messageBody = params.message as string;
      const from = params.from as string;

      // Parse intent with LLM
      const intent = await ctx.llm.chatJson<{
        intent: string;
        item_reference: number | null;
        message: string;
      }>([
        { role: "system", content: WHATSAPP_PARSING_PROMPT },
        { role: "user", content: messageBody },
      ]);

      // Store message
      const messages = await ctx.storage.get<WhatsAppMessage[]>("message_history") || [];
      messages.push({
        id: `msg-${Date.now()}`,
        direction: "incoming",
        content: messageBody,
        timestamp: new Date().toISOString(),
        intent: intent.intent,
      });
      messages.push({
        id: `msg-${Date.now() + 1}`,
        direction: "outgoing",
        content: intent.message,
        timestamp: new Date().toISOString(),
      });
      await ctx.storage.set("message_history", messages);

      // Re-render with updated messages
      const data = await whatsappAgent.execute(ctx);
      return whatsappAgent.render(data, ctx);
    }

    if (actionId === "toggle_reminders") {
      // Re-render the view (config change is handled by PATCH /api/agents/[slug])
      const data = await whatsappAgent.execute(ctx);
      return whatsappAgent.render(data, ctx);
    }
  },
};

registerAgent(whatsappAgent);
