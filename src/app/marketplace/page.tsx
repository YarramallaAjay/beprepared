"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/agents" className="text-muted-foreground hover:text-foreground text-sm">
              &larr; Agent Library
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <h1 className="text-lg font-bold">Marketplace</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card>
          <CardContent className="py-16 text-center">
            <span className="text-4xl block mb-4">🏪</span>
            <h2 className="text-xl font-bold mb-2">Agent Marketplace</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Discover and install community-built agents. The marketplace is coming soon.
              In the meantime, you can submit your own agents for review.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/agents">
                <Button variant="outline">Browse Installed Agents</Button>
              </Link>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  window.open("https://github.com", "_blank");
                }}
              >
                Submit Your Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
