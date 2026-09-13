import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { curateContent } from "@/lib/ai/content-curator";
import { invalidateUserContext } from "@/lib/ai/user-context";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get character doc
    const { data: charDoc } = await supabase
      .from("character_documents")
      .select("content_md")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    // Get preferred sources
    const { data: sources } = await supabase
      .from("preferred_sources")
      .select("*")
      .eq("user_id", user.id)
      .order("priority_rank", { ascending: true });

    // Extract people from sources
    const people = (sources || [])
      .filter((s) => s.source_type === "person")
      .map((s) => s.source_name);

    // Curate content
    const result = await curateContent(
      profile,
      charDoc?.content_md || null,
      sources || [],
      people,
      user.id
    );

    // Clear existing content items and insert new ones
    await supabase.from("content_items").delete().eq("user_id", user.id);

    const contentItems = result.items.map((item) => ({
      user_id: user.id,
      title: item.title,
      url: item.url,
      content_type: item.content_type,
      topic: item.topic,
      description: item.description,
      estimated_minutes: item.estimated_minutes,
      priority: item.priority,
      source_origin: item.source_origin,
      week_number: item.week_number,
      status: "pending",
    }));

    const { error: insertError } = await supabase
      .from("content_items")
      .insert(contentItems);

    if (insertError) throw insertError;

    invalidateUserContext(user.id);

    return NextResponse.json({
      items_count: result.items.length,
      total_weeks: result.total_weeks,
      roadmap_summary: result.roadmap_summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Curation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
