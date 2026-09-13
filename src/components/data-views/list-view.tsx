"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { DataViewPayloads, DataViewAction } from "@/lib/agents/types";

interface ListViewProps {
  data: DataViewPayloads["list"];
  onAction?: (actionId: string, params?: Record<string, unknown>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "border-l-zinc-600",
  in_progress: "border-l-amber-500",
  completed: "border-l-emerald-500",
  skipped: "border-l-zinc-500",
};

export function ListView({ data, onAction }: ListViewProps) {
  const items = data.items || [];
  const completed = items.filter((i) => i.status === "completed").length;
  const total = items.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {total > 0 && (
        <div className="flex items-center gap-3 px-1">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {completed}/{total}
          </span>
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 py-2.5 px-3 rounded-lg border-l-2 bg-zinc-900/40 ${
              STATUS_COLORS[item.status || "pending"] || STATUS_COLORS.pending
            } ${item.status === "completed" ? "opacity-50" : ""}`}
          >
            {item.status !== undefined && (
              <Checkbox
                checked={item.status === "completed"}
                onCheckedChange={() => {
                  if (onAction) {
                    const action = item.actions?.find(
                      (a) => a.handler === "mark_done" || a.handler === "toggle"
                    );
                    if (action) onAction(action.handler, action.params);
                  }
                }}
                className="mt-0.5"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    item.status === "completed"
                      ? "line-through text-muted-foreground"
                      : ""
                  }`}
                >
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </span>
                {item.badge && (
                  <Badge
                    variant={
                      item.badge.variant === "success"
                        ? "default"
                        : item.badge.variant === "error"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {item.badge.text}
                  </Badge>
                )}
              </div>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.subtitle}
                </p>
              )}
            </div>
            {item.actions && onAction && (
              <div className="flex gap-1 flex-shrink-0">
                {item.actions
                  .filter(
                    (a) =>
                      a.handler !== "mark_done" && a.handler !== "toggle"
                  )
                  .map((action: DataViewAction) => (
                    <Button
                      key={action.handler}
                      onClick={() => onAction(action.handler, action.params)}
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                    >
                      {action.label}
                    </Button>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
