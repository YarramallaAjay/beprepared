import type { AgentDefinition, AgentContext, DataView } from "./types";
import type { AgentYAMLSchema, ExecutionStep } from "./schema/agent-schema";
import { validateAgentSchema } from "./schema/agent-schema";

/**
 * Load a YAML/JSON agent definition and produce an AgentDefinition object.
 * The execute method is assembled from the declarative execution_steps.
 */
export function loadAgentFromSchema(schema: AgentYAMLSchema): AgentDefinition {
  const validation = validateAgentSchema(schema);
  if (!validation.valid) {
    throw new Error(`Invalid agent schema: ${validation.errors.join(", ")}`);
  }

  const definition: AgentDefinition = {
    identity: {
      slug: schema.identity.slug,
      name: schema.identity.name,
      description: schema.identity.description,
      version: schema.identity.version,
      author: schema.identity.author,
      category: "custom",
    },

    configFields: (schema.config?.fields || []).map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      default: f.default,
      required: f.required,
      options: f.options,
      description: f.description,
    })),

    permissions: (schema.permissions || []).map((p) => ({
      resource: p.resource,
      actions: p.actions as ("read" | "write" | "delete")[],
    })),

    tools: (schema.tools || []).map((t) => ({
      name: t.name,
      required: t.required,
    })),

    mcpConnections: (schema.mcp_connections || []).map((m) => ({
      server_url: m.server_url,
      name: m.name,
      auth_type: m.auth_type as "none" | "bearer" | "api_key" | undefined,
      tools: m.tools,
    })),

    dataViewType: schema.data_view_type as AgentDefinition["dataViewType"],
    defaultExecutionMode: schema.execution?.mode || "on_demand",
    defaultSchedule: schema.execution?.schedule,
    defaultEventTriggers: schema.execution?.event_triggers,

    async validate() {
      return { valid: true };
    },

    async execute(ctx: AgentContext): Promise<Record<string, unknown>> {
      return executeSteps(schema.instructions.execution_steps, schema.instructions.system_prompt, ctx);
    },

    async render(data: Record<string, unknown>): Promise<DataView> {
      const template = schema.instructions.render_template;
      if (template) {
        return renderFromTemplate(template, data);
      }
      // Default: render as the declared data_view_type with raw data
      return {
        type: schema.data_view_type as DataView["type"],
        title: schema.identity.name,
        data: data as DataView["data"],
        updated_at: new Date().toISOString(),
      };
    },
  };

  return definition;
}

/**
 * Execute declarative steps: tool calls and LLM calls in sequence.
 */
async function executeSteps(
  steps: ExecutionStep[],
  systemPrompt: string,
  ctx: AgentContext
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};

  for (const step of steps) {
    if (step.tool && step.query && step.output) {
      // Tool call step
      let toolResult: unknown;
      switch (step.tool) {
        case "web_search":
          toolResult = await ctx.tools.searchWeb(step.query);
          break;
        case "youtube_search":
          toolResult = await ctx.tools.searchYouTube(step.query);
          break;
        default:
          throw new Error(`Unknown tool: ${step.tool}`);
      }
      results[step.output] = toolResult;
    } else if (step.llm && step.output) {
      // LLM call step
      const inputData: Record<string, unknown> = {};
      if (step.input) {
        for (const inputKey of step.input) {
          if (inputKey === "user_profile") {
            inputData.profile = await ctx.db.getProfile();
          } else if (results[inputKey]) {
            inputData[inputKey] = results[inputKey];
          }
        }
      }

      const llmResult = await ctx.llm.chatJson(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(inputData, null, 2) },
        ]
      );
      results[step.output] = llmResult;
    }
  }

  return results;
}

/**
 * Render data using a template definition.
 */
function renderFromTemplate(
  template: { type: string; map: Record<string, unknown> },
  data: Record<string, unknown>
): DataView {
  // Simple template rendering: map template fields to data
  const viewData: Record<string, unknown> = {};

  for (const [key, path] of Object.entries(template.map)) {
    if (typeof path === "string" && data[path] !== undefined) {
      viewData[key] = data[path];
    } else {
      viewData[key] = path;
    }
  }

  return {
    type: template.type as DataView["type"],
    title: "Agent Output",
    data: viewData as DataView["data"],
    updated_at: new Date().toISOString(),
  };
}
