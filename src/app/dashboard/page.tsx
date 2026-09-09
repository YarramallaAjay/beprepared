"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

interface ContentItem {
  id: string;
  title: string;
  url: string;
  content_type: string;
  topic: string;
  description: string;
  estimated_minutes: number;
  source_origin: string;
  status: string;
}

interface PlanItem {
  id: string;
  item_order: number;
  status: string;
  content_items: ContentItem;
}

interface DailyPlan {
  id: string;
  plan_date: string;
  daily_plan_items: PlanItem[];
}

const TYPE_COLORS: Record<string, string> = {
  blog: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  video: "bg-red-500/20 text-red-300 border-red-500/40",
  course: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  repo: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  documentation: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  practice: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  other: "bg-muted text-muted-foreground border-border",
};

export default function DashboardPage() {
  const supabase = createClient();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [allItems, setAllItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [streak, setStreak] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch content items first (needed to know if we can auto-generate a plan)
    const { data: items } = await supabase
      .from("content_items")
      .select("*")
      .eq("user_id", user.id)
      .order("week_number", { ascending: true })
      .order("priority", { ascending: false });
    setAllItems(items || []);

    // Fetch today's plan
    const planRes = await fetch("/api/daily-plan");
    const planData = await planRes.json();

    if (planData.plan) {
      setPlan(planData.plan);
    } else if (items && items.some((i) => i.status === "pending")) {
      // Auto-generate today's plan if content exists but no plan yet
      setGenerating(true);
      try {
        const genRes = await fetch("/api/daily-plan", { method: "POST" });
        const genData = await genRes.json();
        if (genData.plan) setPlan(genData.plan);
      } catch {
        // Failed to auto-generate, user can retry manually
      }
      setGenerating(false);
    }

    // Calculate streak
    const { data: plans } = await supabase
      .from("daily_plans")
      .select("plan_date, daily_plan_items(status)")
      .eq("user_id", user.id)
      .order("plan_date", { ascending: false })
      .limit(30);

    let s = 0;
    if (plans) {
      for (const p of plans) {
        const planItems = p.daily_plan_items as unknown as { status: string }[];
        if (planItems.some((i) => i.status === "completed")) s++;
        else break;
      }
    }
    setStreak(s);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function generatePlan() {
    setGenerating(true);
    const res = await fetch("/api/daily-plan", { method: "POST" });
    const data = await res.json();
    setPlan(data.plan);
    setGenerating(false);
  }

  async function toggleItem(itemId: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    await fetch("/api/daily-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, status: newStatus }),
    });
    fetchData();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-400" />
      </main>
    );
  }

  const todayItems = plan?.daily_plan_items || [];
  const completedToday = todayItems.filter((i) => i.status === "completed").length;
  const totalToday = todayItems.length;
  const dailyProgress = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

  const totalItems = allItems.length;
  const totalCompleted = allItems.filter((i) => i.status === "completed").length;
  const overallProgress = totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            Be<span className="text-emerald-400">Prepared</span>
          </h1>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
              {streak} day streak
            </Badge>
            <Link href="/settings">
              <Button variant="outline" size="sm">Settings</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Today&apos;s Progress</p>
              <p className="text-2xl font-bold text-foreground">{completedToday}/{totalToday}</p>
              <Progress value={dailyProgress} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              <p className="text-2xl font-bold text-foreground">{Math.round(overallProgress)}%</p>
              <Progress value={overallProgress} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Content Library</p>
              <p className="text-2xl font-bold text-foreground">{totalItems} items</p>
              <p className="text-xs text-muted-foreground mt-1">{totalCompleted} completed</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="today" className="w-full">
          <TabsList>
            <TabsTrigger value="today">Today&apos;s Plan</TabsTrigger>
            <TabsTrigger value="library">Content Library</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4">
            {!plan ? (
              <Card>
                <CardContent className="py-12 text-center">
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-400 mx-auto mb-4" />
                      <p className="text-muted-foreground">Generating your daily plan...</p>
                    </>
                  ) : allItems.length === 0 ? (
                    <>
                      <p className="text-muted-foreground mb-4">No curated content yet. Run curation to get started.</p>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={async () => {
                          setGenerating(true);
                          await fetch("/api/curate", { method: "POST" });
                          await fetchData();
                          setGenerating(false);
                        }}
                      >
                        Curate Content Now
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4">No plan generated for today yet.</p>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={generatePlan}
                        disabled={generating}
                      >
                        Generate Today&apos;s Plan
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {todayItems
                  .sort((a, b) => a.item_order - b.item_order)
                  .map((item) => {
                    const ci = item.content_items;
                    return (
                      <Card
                        key={item.id}
                        className={`transition-opacity ${item.status === "completed" ? "opacity-50" : ""}`}
                      >
                        <CardContent className="py-3 flex items-start gap-3">
                          <Checkbox
                            checked={item.status === "completed"}
                            onCheckedChange={() => toggleItem(item.id, item.status)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm text-foreground ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                                {ci.title}
                              </span>
                              <Badge variant="outline" className={`text-xs ${TYPE_COLORS[ci.content_type] || TYPE_COLORS.other}`}>
                                {ci.content_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">~{ci.estimated_minutes}min</span>
                            </div>
                            {ci.description && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{ci.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {ci.url && (
                                <a href={ci.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline">
                                  Open link
                                </a>
                              )}
                              {ci.source_origin && (
                                <span className="text-xs text-muted-foreground/60">via {ci.source_origin}</span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="mt-4">
            <div className="space-y-3">
              {allItems.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      No content yet. Complete onboarding to get personalized recommendations.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                allItems.map((item) => (
                  <Card key={item.id} className={item.status === "completed" ? "opacity-50" : ""}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${TYPE_COLORS[item.content_type] || TYPE_COLORS.other}`}>
                          {item.content_type}
                        </Badge>
                        <span className="text-sm text-foreground">{item.title}</span>
                        <span className="text-xs text-muted-foreground">~{item.estimated_minutes}min</span>
                        {item.status === "completed" && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Done</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.topic}{item.source_origin ? ` | via ${item.source_origin}` : ""}
                      </p>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline">
                          {item.url}
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
