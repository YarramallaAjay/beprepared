import type { AgentContext, DataView, RunStatus, TriggerType } from "./types";
import { getAgentDefinition } from "./registry";
import { createAgentLLMService } from "./services/llm-service";
import { createAgentStorageService } from "./services/storage-service";
import { createAgentToolService } from "./services/tool-service";
import { createAgentDBService } from "./services/db-service";
import { createServiceRoleClient } from "../supabase/server";

export interface RunAgentInput {
  userAgentId: string;
  userId: string;
  agentSlug: string;
  agentId: string;
  triggerType: TriggerType;
  inputParams?: Record<string, unknown>;
}

export interface RunAgentResult {
  runId: string;
  status: RunStatus;
  dataView?: DataView;
  error?: string;
  durationMs: number;
}

/**
 * Execute an agent: validate → execute → render → store results.
 */
export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const startTime = Date.now();
  const supabase = await createServiceRoleClient();

  // Create run record
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      user_agent_id: input.userAgentId,
      user_id: input.userId,
      agent_id: input.agentId,
      trigger_type: input.triggerType,
      status: "running",
      input_params: input.inputParams || {},
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runError || !run) {
    return {
      runId: "",
      status: "failed",
      error: `Failed to create run record: ${runError?.message}`,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    // Load agent definition
    const definition = getAgentDefinition(input.agentSlug);

    // Load user config
    const { data: userAgent } = await supabase
      .from("user_agents")
      .select("config")
      .eq("id", input.userAgentId)
      .single();

    // Build context
    const ctx: AgentContext = {
      userId: input.userId,
      userConfig: (userAgent?.config as Record<string, unknown>) || {},
      agentSlug: input.agentSlug,
      runId: run.id,
      llm: createAgentLLMService(input.userId),
      storage: createAgentStorageService(input.userAgentId),
      tools: createAgentToolService(),
      db: createAgentDBService(input.userId),
    };

    // Validate config
    const validation = await definition.validate(ctx.userConfig);
    if (!validation.valid) {
      throw new Error(`Config validation failed: ${validation.errors?.join(", ")}`);
    }

    // Execute
    const rawOutput = await definition.execute(ctx);

    // Render to DataView
    const dataView = await definition.render(rawOutput, ctx);

    // Store results
    const durationMs = Date.now() - startTime;
    await supabase
      .from("agent_runs")
      .update({
        status: "completed",
        output_data: rawOutput,
        data_view: dataView as unknown as Record<string, unknown>,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", run.id);

    // Upsert latest data view
    await supabase.from("agent_data_views").upsert(
      {
        user_agent_id: input.userAgentId,
        agent_run_id: run.id,
        view_type: dataView.type,
        view_data: dataView as unknown as Record<string, unknown>,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_agent_id" }
    );

    // Update last_run_at on user_agents
    await supabase
      .from("user_agents")
      .update({ last_run_at: new Date().toISOString(), status: "active" })
      .eq("id", input.userAgentId);

    console.log(
      `[AgentRuntime] ${input.agentSlug} completed in ${durationMs}ms`
    );

    // Fire pipeline triggers (non-blocking)
    checkPipelineTriggers(input.agentSlug, input.userId, dataView).catch(
      (err) =>
        console.error(
          `[AgentRuntime] Pipeline trigger error after ${input.agentSlug}:`,
          err
        )
    );

    return { runId: run.id, status: "completed", dataView, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", run.id);

    await supabase
      .from("user_agents")
      .update({ status: "error" })
      .eq("id", input.userAgentId);

    console.error(
      `[AgentRuntime] ${input.agentSlug} failed in ${durationMs}ms: ${errorMessage}`
    );

    return { runId: run.id, status: "failed", error: errorMessage, durationMs };
  }
}

/**
 * Handle a DataView action for an agent.
 */
export async function handleAgentAction(
  userAgentId: string,
  userId: string,
  agentSlug: string,
  actionId: string,
  params: Record<string, unknown>
): Promise<DataView | null> {
  const definition = getAgentDefinition(agentSlug);

  if (!definition.handleAction) {
    throw new Error(`Agent "${agentSlug}" does not support actions`);
  }

  const supabase = await createServiceRoleClient();
  const { data: userAgent } = await supabase
    .from("user_agents")
    .select("config")
    .eq("id", userAgentId)
    .single();

  const ctx: AgentContext = {
    userId,
    userConfig: (userAgent?.config as Record<string, unknown>) || {},
    agentSlug,
    runId: "",
    llm: createAgentLLMService(userId),
    storage: createAgentStorageService(userAgentId),
    tools: createAgentToolService(),
    db: createAgentDBService(userId),
  };

  const result = await definition.handleAction(actionId, params, ctx);

  // If action returns a new DataView, update the stored view
  if (result) {
    await supabase.from("agent_data_views").upsert(
      {
        user_agent_id: userAgentId,
        view_type: result.type,
        view_data: result as unknown as Record<string, unknown>,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_agent_id" }
    );
  }

  return result || null;
}

/**
 * Pipeline triggers: automatically run downstream agents when an upstream agent completes.
 */
const PIPELINE_TRIGGERS: Record<string, { next: string; condition?: (view: DataView) => boolean }> = {
  interview: {
    next: "character",
    condition: (view) => view.metadata?.phase === "complete",
  },
  character: {
    next: "content-discovery",
  },
  "content-discovery": {
    next: "daily-plan",
  },
};

async function checkPipelineTriggers(
  completedSlug: string,
  userId: string,
  dataView: DataView
): Promise<void> {
  const trigger = PIPELINE_TRIGGERS[completedSlug];
  if (!trigger) return;

  // Check condition if present
  if (trigger.condition && !trigger.condition(dataView)) return;

  const supabase = await createServiceRoleClient();

  // Find the downstream agent
  const { data: nextAgent } = await supabase
    .from("agents")
    .select("id, slug")
    .eq("slug", trigger.next)
    .eq("status", "active")
    .single();

  if (!nextAgent) {
    console.log(`[Pipeline] Downstream agent "${trigger.next}" not found, skipping`);
    return;
  }

  // Check if user has the downstream agent installed; if not, auto-install
  let { data: userAgent } = await supabase
    .from("user_agents")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_id", nextAgent.id)
    .single();

  if (!userAgent) {
    const { data: installed } = await supabase
      .from("user_agents")
      .insert({
        user_id: userId,
        agent_id: nextAgent.id,
        config: {},
        execution_mode: "on_demand",
        status: "active",
      })
      .select("id")
      .single();
    userAgent = installed;
  }

  if (!userAgent) {
    console.error(`[Pipeline] Failed to install downstream agent "${trigger.next}"`);
    return;
  }

  console.log(`[Pipeline] Triggering "${trigger.next}" after "${completedSlug}" completed`);

  await runAgent({
    userAgentId: userAgent.id,
    userId,
    agentSlug: nextAgent.slug,
    agentId: nextAgent.id,
    triggerType: "pipeline",
  });
}
