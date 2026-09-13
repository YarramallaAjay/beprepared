import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET: Get agent details + user's installation
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
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: installation } = await supabase
    .from("user_agents")
    .select("*, agent_data_views(view_type, view_data, generated_at)")
    .eq("user_id", user.id)
    .eq("agent_id", agent.id)
    .single();

  return NextResponse.json({ agent, installation });
}

// PATCH: Update user's agent config
export async function PATCH(
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
  const { config, execution_mode, schedule, status } = body;

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (config !== undefined) updates.config = config;
  if (execution_mode !== undefined) updates.execution_mode = execution_mode;
  if (schedule !== undefined) updates.schedule = schedule;
  if (status !== undefined) updates.status = status;

  const { data: updated, error } = await supabase
    .from("user_agents")
    .update(updates)
    .eq("user_id", user.id)
    .eq("agent_id", agent.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ installation: updated });
}

// DELETE: Uninstall agent
export async function DELETE(
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

  await supabase
    .from("user_agents")
    .delete()
    .eq("user_id", user.id)
    .eq("agent_id", agent.id);

  return NextResponse.json({ success: true });
}
