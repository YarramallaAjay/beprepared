import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch everything in parallel
  const [agentsRes, userAgentsRes, plansRes, profileRes] = await Promise.all([
    supabase
      .from("agents")
      .select("id, slug, name, description, icon, color, category, data_view_type, config_schema, default_config")
      .eq("status", "active")
      .order("category")
      .order("name"),
    supabase
      .from("user_agents")
      .select("*, agent_data_views(view_type, view_data, generated_at)")
      .eq("user_id", user.id),
    supabase
      .from("daily_plans")
      .select("plan_date, daily_plan_items(id, status, item_order, content_items(title, content_type, estimated_minutes, url))")
      .eq("user_id", user.id)
      .order("plan_date", { ascending: false })
      .limit(30),
    supabase.from("profiles").select("full_name, onboarding_completed").eq("id", user.id).single(),
  ]);

  const agents = agentsRes.data || [];
  const userAgents = userAgentsRes.data || [];
  const plans = plansRes.data || [];
  const profile = profileRes.data;

  // Build install map
  const installMap = new Map(userAgents.map((ua) => [ua.agent_id, ua]));

  // Determine onboarding progress by checking agent_data_views
  const agentSlugs = new Map(agents.map((a) => [a.id, a.slug]));
  const completedAgents = new Set<string>();
  for (const ua of userAgents) {
    const slug = agentSlugs.get(ua.agent_id);
    if (!slug) continue;
    const views = ua.agent_data_views as unknown as { view_data: unknown }[] | null;
    if (views && views.length > 0) {
      completedAgents.add(slug);
    }
  }

  const onboarding = {
    interview_complete: completedAgents.has("interview"),
    character_complete: completedAgents.has("character"),
    content_discovery_complete: completedAgents.has("content-discovery"),
    daily_plan_active: completedAgents.has("daily-plan"),
    all_complete:
      completedAgents.has("interview") &&
      completedAgents.has("character") &&
      completedAgents.has("content-discovery") &&
      completedAgents.has("daily-plan"),
  };

  // Calculate streak
  let streakDays = 0;
  for (const p of plans) {
    const items = p.daily_plan_items as unknown as { status: string }[];
    if (items && items.some((i) => i.status === "completed")) {
      streakDays++;
    } else {
      break;
    }
  }

  // Today's plan
  const today = new Date().toISOString().split("T")[0];
  const todayPlan = plans.find((p) => p.plan_date === today);
  type PlanItemRow = { id: string; status: string; item_order: number; content_items: { title: string; content_type: string; estimated_minutes: number; url: string } };
  const todayItems = todayPlan
    ? ((todayPlan.daily_plan_items as unknown as PlanItemRow[]) || []).sort(
        (a, b) => a.item_order - b.item_order
      )
    : [];
  const completedToday = todayItems.filter((i) => i.status === "completed").length;
  const nextItem = todayItems.find((i) => i.status !== "completed");

  // Total completed items
  const allItems = plans.flatMap(
    (p) => (p.daily_plan_items as unknown as { status: string }[]) || []
  );
  const totalCompleted = allItems.filter((i) => i.status === "completed").length;

  // Build agent list with installation info
  const agentList = agents.map((agent) => {
    const inst = installMap.get(agent.id);
    return {
      ...agent,
      installed: !!inst,
      execution_mode: inst?.execution_mode || "on_demand",
      status: inst?.status || "active",
      last_run_at: inst?.last_run_at || null,
    };
  });

  return NextResponse.json({
    user_name: profile?.full_name?.split(" ")[0] || "there",
    onboarding,
    stats: {
      streak_days: streakDays,
      items_completed_today: completedToday,
      total_items_completed: totalCompleted,
      total_today: todayItems.length,
    },
    todays_plan: todayItems.length > 0
      ? {
          items: todayItems.map((i) => ({
            id: i.id,
            title: i.content_items?.title || "Untitled",
            content_type: i.content_items?.content_type || "other",
            estimated_minutes: i.content_items?.estimated_minutes || 0,
            url: i.content_items?.url || null,
            status: i.status,
          })),
          completed: completedToday,
          total: todayItems.length,
          next_item: nextItem
            ? {
                id: nextItem.id,
                title: nextItem.content_items?.title || "Untitled",
                content_type: nextItem.content_items?.content_type || "other",
                estimated_minutes: nextItem.content_items?.estimated_minutes || 0,
                url: nextItem.content_items?.url || null,
              }
            : null,
        }
      : null,
    agents: agentList,
  });
}
