import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateAgentSchema, type AgentYAMLSchema } from "@/lib/agents/schema/agent-schema";

// POST: Submit a custom agent for review
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { repo_url, agent_yaml } = body;

  if (!repo_url || !agent_yaml) {
    return NextResponse.json(
      { error: "repo_url and agent_yaml are required" },
      { status: 400 }
    );
  }

  // Validate the schema
  const validation = validateAgentSchema(agent_yaml as AgentYAMLSchema);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid agent schema", details: validation.errors },
      { status: 400 }
    );
  }

  // Check for slug conflict
  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("slug", agent_yaml.identity.slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `Agent with slug "${agent_yaml.identity.slug}" already exists` },
      { status: 409 }
    );
  }

  // Create submission
  const { data: submission, error } = await supabase
    .from("agent_submissions")
    .insert({
      submitted_by: user.id,
      repo_url,
      agent_yaml,
      review_status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    submission,
    message: "Agent submitted for review. You'll be notified when it's approved.",
  });
}

// GET: List user's submissions
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: submissions } = await supabase
    .from("agent_submissions")
    .select("*")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ submissions: submissions || [] });
}
