"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface AgentEntry {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  data_view_type: string;
  installed: boolean;
}

export default function AgentLibraryPage() {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        const data = await res.json();
        setAgents(data.agents || []);
      } catch {
        // Fetch error
      }
      setLoading(false);
    }
    fetchAgents();
  }, []);

  async function installAgent(slug: string) {
    setInstallingSlug(slug);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_slug: slug }),
      });
      if (res.ok) {
        setAgents((prev) =>
          prev.map((a) => (a.slug === slug ? { ...a, installed: true } : a))
        );
      }
    } catch {
      // Install failed
    }
    setInstallingSlug(null);
  }

  async function uninstallAgent(slug: string) {
    try {
      const res = await fetch(`/api/agents/${slug}`, { method: "DELETE" });
      if (res.ok) {
        setAgents((prev) =>
          prev.map((a) => (a.slug === slug ? { ...a, installed: false } : a))
        );
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

  const builtin = agents.filter((a) => a.category === "builtin");
  const custom = agents.filter((a) => a.category !== "builtin");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground text-sm">
              &larr; Dashboard
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <h1 className="text-lg font-bold">Agent Library</h1>
          </div>
          <Link href="/marketplace">
            <Button variant="outline" size="sm">Marketplace</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Built-in Agents */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Built-in Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {builtin.map((agent) => (
              <Card key={agent.slug}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{agent.icon}</span>
                      <div>
                        <h3 className="text-sm font-medium">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {agent.description}
                        </p>
                        <Badge variant="secondary" className="text-xs mt-2">
                          {agent.data_view_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {agent.installed ? (
                      <>
                        <Link href={`/agents/${agent.slug}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            Configure
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => uninstallAgent(agent.slug)}
                          className="text-muted-foreground"
                        >
                          Uninstall
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => installAgent(agent.slug)}
                        disabled={installingSlug === agent.slug}
                      >
                        {installingSlug === agent.slug ? "Installing..." : "Install"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Custom/Community Agents */}
        {custom.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Community Agents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {custom.map((agent) => (
                <Card key={agent.slug}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{agent.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {agent.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {agent.installed ? (
                        <>
                          <Link href={`/agents/${agent.slug}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              Configure
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => uninstallAgent(agent.slug)}
                            className="text-muted-foreground"
                          >
                            Uninstall
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => installAgent(agent.slug)}
                          disabled={installingSlug === agent.slug}
                        >
                          {installingSlug === agent.slug ? "Installing..." : "Install"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
