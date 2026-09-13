import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agents/runtime";
import "@/lib/agents/builtin";

// POST: Trigger agent execution
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get agent + user installation
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: userAgent } = await supabase
    .from("user_agents")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("agent_id", agent.id)
    .single();

  if (!userAgent) {
    return NextResponse.json({ error: "Agent not installed" }, { status: 400 });
  }

  let inputParams = {};
  try {
    const body = await request.json();
    inputParams = body.params || {};
  } catch {
    // No body is fine for manual triggers
  }

  const result = await runAgent({
    userAgentId: userAgent.id,
    userId: user.id,
    agentSlug: slug,
    agentId: agent.id,
    triggerType: "manual",
    inputParams,
  });

  if (result.status === "failed") {
    return NextResponse.json(
      { error: result.error, runId: result.runId },
      { status: 500 }
    );
  }

  return NextResponse.json({
    runId: result.runId,
    status: result.status,
    dataView: result.dataView,
    durationMs: result.durationMs,
  });
}

// GET: Get latest run result
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: runs } = await supabase
    .from("agent_runs")
    .select("id, status, trigger_type, started_at, completed_at, duration_ms, error_message, created_at")
    .eq("user_id", user.id)
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ runs: runs || [] });
}
