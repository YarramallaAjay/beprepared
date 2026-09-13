"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataViewRenderer } from "@/components/data-views";
import { OnboardingProgress } from "@/components/dashboard/onboarding-progress";
import { TodaysPlanHero } from "@/components/dashboard/todays-plan-hero";
import { StatsRow } from "@/components/dashboard/stats-row";
import type { DataView } from "@/lib/agents/types";
import Link from "next/link";

interface DashboardData {
  user_name: string;
  onboarding: {
    interview_complete: boolean;
    character_complete: boolean;
    content_discovery_complete: boolean;
    daily_plan_active: boolean;
    all_complete: boolean;
  };
  stats: {
    streak_days: number;
    items_completed_today: number;
    total_items_completed: number;
    total_today: number;
  };
  todays_plan: {
    items: {
      id: string;
      title: string;
      content_type: string;
      estimated_minutes: number;
      url: string | null;
      status: string;
    }[];
    completed: number;
    total: number;
    next_item: {
      id: string;
      title: string;
      content_type: string;
      estimated_minutes: number;
      url: string | null;
    } | null;
  } | null;
  agents: {
    id: string;
    slug: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    category: string;
    installed: boolean;
    execution_mode: string;
    status: string;
    last_run_at: string | null;
  }[];
}

interface AgentWithView {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  installed: boolean;
  execution_mode: string;
  status: string;
  last_run_at: string | null;
  view: DataView | null;
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [agents, setAgents] = useState<AgentWithView[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) return;
      const data: DashboardData = await res.json();
      setDashboard(data);

      // Fetch views for installed agents
      const installedAgents = data.agents.filter((a) => a.installed);
      const agentsWithViews: AgentWithView[] = await Promise.all(
        installedAgents.map(async (agent) => {
          let view: DataView | null = null;
          try {
            const viewRes = await fetch(`/api/agents/${agent.slug}/view`);
            if (viewRes.ok) {
              const viewData = await viewRes.json();
              view = viewData.view || null;
            }
          } catch {
            // No view available
          }
          return { ...agent, view };
        })
      );
      setAgents(agentsWithViews);
    } catch {
      // Failed to fetch
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  async function runAgent(slug: string) {
    setRunningAgents((prev) => new Set(prev).add(slug));
    try {
      await fetch(`/api/agents/${slug}/run`, { method: "POST" });
      const viewRes = await fetch(`/api/agents/${slug}/view`);
      if (viewRes.ok) {
        const viewData = await viewRes.json();
        setAgents((prev) =>
          prev.map((a) =>
            a.slug === slug
              ? { ...a, view: viewData.view || null, last_run_at: new Date().toISOString() }
              : a
          )
        );
      }
    } catch {
      // Run failed
    }
    setRunningAgents((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
  }

  async function handleAction(slug: string, actionId: string, params?: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/agents/${slug}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId, params }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.view) {
          setAgents((prev) =>
            prev.map((a) => (a.slug === slug ? { ...a, view: data.view } : a))
          );
        }
      }
    } catch {
      // Action failed
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-400" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  const isNewUser = dashboard && !dashboard.onboarding.all_complete;
  const hasActivePlan = dashboard?.todays_plan && dashboard.todays_plan.total > 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Sticky header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            Be<span className="text-emerald-400">Prepared</span>
          </h1>
          <div className="flex items-center gap-3">
            <Link href="/agents">
              <Button variant="outline" size="sm">
                Agent Library
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" size="sm">
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Onboarding progress for new users */}
        {isNewUser && dashboard && (
          <OnboardingProgress onboarding={dashboard.onboarding} />
        )}

        {/* Today's plan hero for returning users */}
        {!isNewUser && hasActivePlan && dashboard && (
          <TodaysPlanHero
            userName={dashboard.user_name}
            completed={dashboard.todays_plan!.completed}
            total={dashboard.todays_plan!.total}
            nextItem={dashboard.todays_plan!.next_item}
          />
        )}

        {/* Greeting for returning users without a plan */}
        {!isNewUser && !hasActivePlan && dashboard && (
          <div className="text-center py-4">
            <h2 className="text-lg font-semibold">
              Welcome back, {dashboard.user_name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              No plan for today yet. Run the Daily Plan agent to generate one.
            </p>
          </div>
        )}

        {/* Stats row for returning users */}
        {!isNewUser && dashboard && (
          <StatsRow
            streakDays={dashboard.stats.streak_days}
            itemsCompletedToday={dashboard.stats.items_completed_today}
            totalItemsCompleted={dashboard.stats.total_items_completed}
          />
        )}

        {/* Agent cards */}
        {agents.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Your Agents
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <Card
                  key={agent.slug}
                  className="overflow-hidden border-0 bg-zinc-900/60"
                >
                  <CardContent className="p-0">
                    {/* Colored accent bar */}
                    <div
                      className="h-1"
                      style={{ backgroundColor: agent.color }}
                    />
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                      <Link
                        href={`/dashboard/agents/${agent.slug}`}
                        className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                          style={{ backgroundColor: agent.color + "20" }}
                        >
                          {agent.icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium truncate">
                            {agent.name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {agent.description}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {agent.status === "error" && (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        )}
                        {agent.execution_mode === "on_demand" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runAgent(agent.slug)}
                            disabled={runningAgents.has(agent.slug)}
                            className="border-zinc-700"
                          >
                            {runningAgents.has(agent.slug) ? (
                              <span className="animate-spin inline-block w-3 h-3 border-t-2 border-current rounded-full" />
                            ) : (
                              "Run"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="px-4 py-3 max-h-72 overflow-y-auto">
                      {agent.view ? (
                        <DataViewRenderer
                          view={agent.view}
                          onAction={(actionId, params) =>
                            handleAction(agent.slug, actionId, params)
                          }
                          compact
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          {agent.execution_mode === "on_demand"
                            ? "Run this agent to see results"
                            : "Waiting for next scheduled run"}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Add agent card */}
              <Link href="/agents">
                <Card className="border-dashed border-zinc-700 hover:border-emerald-500/40 transition-colors cursor-pointer h-full min-h-[120px] bg-transparent">
                  <CardContent className="flex items-center justify-center h-full py-8">
                    <div className="text-center">
                      <span className="text-2xl block mb-2 text-zinc-500">+</span>
                      <p className="text-sm text-muted-foreground">
                        Add Agent
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        )}

        {/* Empty state when no agents installed */}
        {agents.length === 0 && !isNewUser && (
          <Card className="border-0 bg-zinc-900/60">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No agents installed yet. Browse the agent library to get
                started.
              </p>
              <Link href="/agents">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Browse Agents
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
