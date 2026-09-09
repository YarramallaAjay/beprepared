import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { callLLMJson } from "@/lib/ai/llm-client";
import { DAILY_PLAN_SYSTEM } from "@/lib/ai/prompts";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  // Check if plan exists for today
  const { data: existingPlan } = await supabase
    .from("daily_plans")
    .select("*, daily_plan_items(*, content_items(*))")
    .eq("user_id", user.id)
    .eq("plan_date", today)
    .single();

  if (existingPlan) {
    return NextResponse.json({ plan: existingPlan });
  }

  return NextResponse.json({ plan: null });
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  try {
    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_hours_available")
      .eq("id", user.id)
      .single();

    const dailyMinutes = (profile?.daily_hours_available || 2) * 60;

    // Get pending content items
    const { data: pendingItems } = await supabase
      .from("content_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("week_number", { ascending: true })
      .order("priority", { ascending: false })
      .limit(20);

    if (!pendingItems || pendingItems.length === 0) {
      return NextResponse.json({ error: "No pending content items. Run curation first." }, { status: 400 });
    }

    // Use LLM to pick the best mix for today
    const result = await callLLMJson<{ selected_ids: string[]; reasoning: string }>(
      "daily_plan",
      [
        { role: "system", content: DAILY_PLAN_SYSTEM },
        {
          role: "user",
          content: `Available time: ${dailyMinutes} minutes\n\nPending items:\n${JSON.stringify(
            pendingItems.map((i) => ({
              id: i.id,
              title: i.title,
              type: i.content_type,
              minutes: i.estimated_minutes,
              priority: i.priority,
              topic: i.topic,
            })),
            null,
            2
          )}\n\nSelect items for today that fit within ${dailyMinutes} minutes. Mix content types. Return JSON: { "selected_ids": [item_ids], "reasoning": "brief explanation" }`,
        },
      ]
    );

    // Create daily plan
    const { data: plan, error: planError } = await supabase
      .from("daily_plans")
      .insert({ user_id: user.id, plan_date: today })
      .select()
      .single();

    if (planError) throw planError;

    // Create plan items
    const planItems = result.selected_ids.map((id: string, index: number) => ({
      daily_plan_id: plan.id,
      content_item_id: id,
      item_order: index,
      status: "pending",
    }));

    await supabase.from("daily_plan_items").insert(planItems);

    // Fetch the complete plan with items
    const { data: completePlan } = await supabase
      .from("daily_plans")
      .select("*, daily_plan_items(*, content_items(*))")
      .eq("id", plan.id)
      .single();

    return NextResponse.json({ plan: completePlan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Update a plan item status
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { item_id, status } = body;

  const { error } = await supabase
    .from("daily_plan_items")
    .update({
      status,
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", item_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also update the content item status if completed
  if (status === "completed") {
    const { data: planItem } = await supabase
      .from("daily_plan_items")
      .select("content_item_id")
      .eq("id", item_id)
      .single();

    if (planItem) {
      await supabase
        .from("content_items")
        .update({ status: "completed" })
        .eq("id", planItem.content_item_id);
    }
  }

  return NextResponse.json({ success: true });
}
