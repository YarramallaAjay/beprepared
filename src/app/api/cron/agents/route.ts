import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agents/runtime";
import "@/lib/agents/builtin";

// GET: Cron endpoint that runs scheduled agents
export async function GET(request: Request) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Find all scheduled agents that are active
  const { data: scheduledAgents } = await supabase
    .from("user_agents")
    .select("id, user_id, agent_id, schedule, last_run_at, agents(slug)")
    .eq("execution_mode", "scheduled")
    .eq("status", "active");

  if (!scheduledAgents || scheduledAgents.length === 0) {
    return NextResponse.json({ message: "No scheduled agents", runs: 0 });
  }

  const results: { slug: string; userId: string; status: string }[] = [];

  for (const ua of scheduledAgents) {
    const agent = ua.agents as unknown as { slug: string } | null;
    if (!agent?.slug) continue;

    // Simple schedule check: if last_run_at is null or more than schedule interval ago
    // For now, run daily agents if not run today
    if (ua.last_run_at) {
      const lastRun = new Date(ua.last_run_at);
      const now = new Date();
      const hoursSinceLastRun =
        (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

      // Default: run if more than 12 hours since last run
      if (hoursSinceLastRun < 12) continue;
    }

    try {
      const result = await runAgent({
        userAgentId: ua.id,
        userId: ua.user_id,
        agentSlug: agent.slug,
        agentId: ua.agent_id,
        triggerType: "scheduled",
      });

      results.push({
        slug: agent.slug,
        userId: ua.user_id,
        status: result.status,
      });
    } catch (err) {
      results.push({
        slug: agent.slug,
        userId: ua.user_id,
        status: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return NextResponse.json({
    message: `Processed ${results.length} scheduled agents`,
    runs: results.length,
    results,
  });
}
