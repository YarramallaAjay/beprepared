import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET: Fetch the latest DataView for this agent
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

  const { data: userAgent } = await supabase
    .from("user_agents")
    .select("id")
    .eq("user_id", user.id)
    .eq("agent_id", agent.id)
    .single();

  if (!userAgent) {
    return NextResponse.json({ error: "Agent not installed" }, { status: 400 });
  }

  const { data: dataView } = await supabase
    .from("agent_data_views")
    .select("*")
    .eq("user_agent_id", userAgent.id)
    .single();

  return NextResponse.json({ view: dataView?.view_data || null });
}
