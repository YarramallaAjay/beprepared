import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_SOURCES } from "@/lib/sources/source-registry";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sources } = await supabase
    .from("preferred_sources")
    .select("*")
    .eq("user_id", user.id)
    .order("priority_rank", { ascending: true });

  return NextResponse.json({ sources: sources || [], defaults: DEFAULT_SOURCES });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { source_name, source_type, source_url } = body;

  // Get next priority rank
  const { count } = await supabase
    .from("preferred_sources")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data, error } = await supabase
    .from("preferred_sources")
    .insert({
      user_id: user.id,
      source_name,
      source_type,
      source_url,
      priority_rank: (count || 0) + 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { error } = await supabase
    .from("preferred_sources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PUT: Reorder sources
export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { ordered_ids } = body as { ordered_ids: string[] };

  for (let i = 0; i < ordered_ids.length; i++) {
    await supabase
      .from("preferred_sources")
      .update({ priority_rank: i + 1 })
      .eq("id", ordered_ids[i])
      .eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}

// Initialize defaults for a new user
export async function initializeDefaultSources(userId: string) {
  const { createServiceRoleClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceRoleClient();

  const sources = DEFAULT_SOURCES.map((s, i) => ({
    user_id: userId,
    source_name: s.source_name,
    source_type: s.source_type,
    source_url: s.source_url,
    priority_rank: i + 1,
  }));

  await supabase.from("preferred_sources").insert(sources);
}
