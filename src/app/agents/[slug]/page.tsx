"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentConfigForm } from "@/components/agents/agent-config-form";
import type { AgentConfigField } from "@/lib/agents/types";
import Link from "next/link";

interface AgentDetailData {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  version: string;
  author: string;
  data_view_type: string;
  execution_mode: string;
  schedule: string | null;
  config: Record<string, unknown>;
  config_schema: AgentConfigField[];
  installed: boolean;
}

export default function AgentConfigPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [agent, setAgent] = useState<AgentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${slug}`);
        if (res.ok) {
          const data = await res.json();
          const agentRow = data.agent;
          const inst = data.installation;
          if (agentRow) {
            setAgent({
              slug: agentRow.slug,
              name: agentRow.name,
              description: agentRow.description || "",
              icon: agentRow.icon || "🤖",
              color: agentRow.color || "#34d399",
              category: agentRow.category,
              version: agentRow.version,
              author: agentRow.author,
              data_view_type: agentRow.data_view_type,
              execution_mode: inst?.execution_mode || "on_demand",
              schedule: inst?.schedule || null,
              config: inst?.config || agentRow.default_config || {},
              config_schema: agentRow.config_schema || [],
              installed: !!inst,
            });
          }
        }
      } catch {
        // Fetch error
      }
      setLoading(false);
    }
    fetchAgent();
  }, [slug]);

  async function saveConfig(newConfig: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: newConfig }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedConfig = data.installation?.config || newConfig;
        setAgent((prev) => (prev ? { ...prev, config: updatedConfig } : prev));
      }
    } catch {
      // Save failed
    }
    setSaving(false);
  }

  async function uninstall() {
    try {
      const res = await fetch(`/api/agents/${slug}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/agents");
      }
    } catch {
      // Uninstall failed
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
          <Link href="/agents">
            <Button variant="outline">Back to Library</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/agents" className="text-muted-foreground hover:text-foreground text-sm">
              &larr; Library
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <div className="flex items-center gap-2">
              <span className="text-lg">{agent.icon}</span>
              <h1 className="text-lg font-bold">{agent.name}</h1>
            </div>
          </div>
          {agent.installed && (
            <Link href={`/dashboard/agents/${slug}`}>
              <Button variant="outline" size="sm">View Dashboard</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Agent Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">{agent.description}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">{agent.category}</Badge>
              <Badge variant="secondary" className="text-xs">v{agent.version}</Badge>
              <Badge variant="secondary" className="text-xs">{agent.data_view_type}</Badge>
              <Badge variant="secondary" className="text-xs">{agent.execution_mode}</Badge>
              {agent.schedule && (
                <Badge variant="outline" className="text-xs">{agent.schedule}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">By {agent.author}</p>
          </CardContent>
        </Card>

        {/* Configuration */}
        {agent.installed && agent.config_schema && agent.config_schema.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-medium">Configuration</h3>
              <AgentConfigForm
                fields={agent.config_schema}
                values={agent.config}
                onSave={saveConfig}
                loading={saving}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            {agent.installed ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Uninstalling removes this agent and its data from your dashboard.
                </p>
                <Button variant="destructive" size="sm" onClick={uninstall}>
                  Uninstall
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Install this agent to add it to your dashboard.
                </p>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={async () => {
                    await fetch("/api/agents", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ agent_slug: slug }),
                    });
                    router.push("/dashboard");
                  }}
                >
                  Install
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
