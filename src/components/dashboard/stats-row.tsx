"use client";

import { Card, CardContent } from "@/components/ui/card";

interface StatsRowProps {
  streakDays: number;
  itemsCompletedToday: number;
  totalItemsCompleted: number;
}

export function StatsRow({ streakDays, itemsCompletedToday, totalItemsCompleted }: StatsRowProps) {
  const stats = [
    { value: streakDays, label: "Day streak", icon: "🔥" },
    { value: itemsCompletedToday, label: "Done today", icon: "✅" },
    { value: totalItemsCompleted, label: "Total completed", icon: "📊" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-0 bg-zinc-900/50">
          <CardContent className="py-4 px-3 text-center">
            <span className="text-xs mb-1 block">{stat.icon}</span>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
