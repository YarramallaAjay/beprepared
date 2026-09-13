"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataViewRenderer } from "@/components/data-views";
import type { DataView } from "@/lib/agents/types";
import Link from "next/link";

interface AgentDetail {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  execution_mode: string;
  user_status: string;
  config: Record<string, unknown>;
}

interface RunRecord {
  id: string;
  status: string;
  trigger_type: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

export default function AgentDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [view, setView] = useState<DataView | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchAgent = useCallback(async () => {
    setLoading(true);
    try {
      const [agentRes, viewRes, runRes] = await Promise.all([
        fetch(`/api/agents/${slug}`),
        fetch(`/api/agents/${slug}/view`),
        fetch(`/api/agents/${slug}/run`),
      ]);

      if (agentRes.ok) {
        const agentData = await agentRes.json();
        setAgent(agentData.agent || null);
      }
      if (viewRes.ok) {
        const viewData = await viewRes.json();
        setView(viewData.view || null);
      }
      if (runRes.ok) {
        const runData = await runRes.json();
        setRuns(runData.runs || []);
      }
    } catch {
      // Fetch error
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  async function runAgent() {
    setRunning(true);
    try {
      await fetch(`/api/agents/${slug}/run`, { method: "POST" });
      await fetchAgent();
    } catch {
      // Run failed
    }
    setRunning(false);
  }

  async function handleAction(actionId: string, params?: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/agents/${slug}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId, params }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.view) setView(data.view);
      }
    } catch {
      // Action failed
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-400" />
      </main>
    );
  }

  if (!agent) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Agent not found</p>
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground text-sm">
              &larr; Dashboard
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <div className="flex items-center gap-2">
              <span className="text-lg">{agent.icon}</span>
              <h1 className="text-lg font-bold">{agent.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {agent.execution_mode}
            </Badge>
            {agent.execution_mode === "on_demand" && (
              <Button
                onClick={runAgent}
                disabled={running}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {running ? "Running..." : "Run Now"}
              </Button>
            )}
            <Link href={`/agents/${slug}`}>
              <Button variant="outline" size="sm">Configure</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Pipeline next-step banner */}
        {view?.metadata?.phase === "complete" && !!view?.metadata?.nextAgent && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 px-4 py-3">
            <span className="inline-block w-4 h-4 border-t-2 border-emerald-400 rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-emerald-300">
              <span className="font-medium">Next:</span> Building your{" "}
              {String(view.metadata.nextAgent).replace("-", " ")} profile...
            </p>
          </div>
        )}

        {/* Main DataView */}
        <Card>
          <CardContent className="p-4">
            {view ? (
              <DataViewRenderer view={view} onAction={handleAction} />
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  {agent.execution_mode === "on_demand"
                    ? "Run this agent to see results"
                    : "Waiting for next scheduled run"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Run History */}
        {runs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Run History</h3>
            <div className="space-y-2">
              {runs.map((run) => (
                <Card key={run.id}>
                  <CardContent className="py-2 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          run.status === "completed"
                            ? "default"
                            : run.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {run.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {run.trigger_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {run.duration_ms && <span>{run.duration_ms}ms</span>}
                      <span>{new Date(run.started_at).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
