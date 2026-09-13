import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { handleAgentAction } from "@/lib/agents/runtime";
import "@/lib/agents/builtin";

// POST: Handle a DataView action
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

  const body = await request.json();
  const actionId = body.action_id || body.actionId;
  const actionParams = body.params || {};

  if (!actionId) {
    return NextResponse.json({ error: "action_id required" }, { status: 400 });
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: userAgent } = await supabase
    .from("user_agents")
    .select("id")
    .eq("user_id", user.id)
    .eq("agent_id", agent.id)
    .single();

  if (!userAgent) {
    return NextResponse.json({ error: "Agent not installed" }, { status: 400 });
  }

  try {
    const result = await handleAgentAction(
      userAgent.id,
      user.id,
      slug,
      actionId,
      actionParams || {}
    );

    return NextResponse.json({ view: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
