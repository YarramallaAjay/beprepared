"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TodaysPlanItem {
  id: string;
  title: string;
  content_type: string;
  estimated_minutes: number;
  url: string | null;
}

interface TodaysPlanHeroProps {
  userName: string;
  completed: number;
  total: number;
  nextItem: TodaysPlanItem | null;
}

const TYPE_ICONS: Record<string, string> = {
  video: "▶",
  blog: "📄",
  course: "📚",
  repo: "💻",
  documentation: "📖",
  practice: "🔧",
  other: "📌",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function TodaysPlanHero({ userName, completed, total, nextItem }: TodaysPlanHeroProps) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const remainingItems = total - completed;
  const circumference = 2 * Math.PI * 24; // r=24

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/30">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">
              {getGreeting()}, {userName}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {completed}/{total} items done today
            </p>
          </div>
          {/* Circular progress */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28" cy="28" r="24" fill="none"
                stroke="currentColor" className="text-zinc-800" strokeWidth="4"
              />
              <circle
                cx="28" cy="28" r="24" fill="none"
                stroke="currentColor" className="text-emerald-500" strokeWidth="4"
                strokeDasharray={`${(progress * circumference) / 100} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-400">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Next item */}
        {nextItem && (
          <div className="rounded-xl bg-zinc-800/50 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 flex items-center justify-center flex-shrink-0 text-sm">
              {TYPE_ICONS[nextItem.content_type] || TYPE_ICONS.other}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{nextItem.title}</p>
              <p className="text-xs text-muted-foreground">
                ~{nextItem.estimated_minutes} min
              </p>
            </div>
            {nextItem.url && (
              <a href={nextItem.url} target="_blank" rel="noopener noreferrer">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
                >
                  Start
                </Button>
              </a>
            )}
          </div>
        )}

        {remainingItems > 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {remainingItems} item{remainingItems !== 1 ? "s" : ""} remaining
          </p>
        )}

        {completed === total && total > 0 && (
          <p className="text-sm text-emerald-400 font-medium mt-3 text-center">
            All done for today!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
