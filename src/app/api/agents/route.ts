import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
// Ensure built-in agents are registered
import "@/lib/agents/builtin";

// GET: List all available agents + user's installations
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all active agents
  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .eq("status", "active")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  // Get user's installations
  const { data: userAgents } = await supabase
    .from("user_agents")
    .select("*, agent_data_views(view_type, view_data, generated_at)")
    .eq("user_id", user.id);

  // Map installations by agent_id for easy lookup
  const installMap = new Map(
    (userAgents || []).map((ua) => [ua.agent_id, ua])
  );

  const result = (agents || []).map((agent) => ({
    ...agent,
    installed: installMap.has(agent.id),
    installation: installMap.get(agent.id) || null,
  }));

  return NextResponse.json({ agents: result });
}

// POST: Install an agent for the user
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { agent_slug, agent_id, config, execution_mode, schedule } = body;

  if (!agent_slug && !agent_id) {
    return NextResponse.json({ error: "agent_slug or agent_id required" }, { status: 400 });
  }

  // Verify agent exists (look up by slug or id)
  let query = supabase.from("agents").select("id, slug, default_config, data_view_type").eq("status", "active");
  if (agent_slug) {
    query = query.eq("slug", agent_slug);
  } else {
    query = query.eq("id", agent_id);
  }
  const { data: agent } = await query.single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: userAgent, error } = await supabase
    .from("user_agents")
    .upsert(
      {
        user_id: user.id,
        agent_id: agent.id,
        config: config || agent.default_config || {},
        execution_mode: execution_mode || "on_demand",
        schedule: schedule || null,
        status: "active",
      },
      { onConflict: "user_id,agent_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ installation: userAgent });
}
