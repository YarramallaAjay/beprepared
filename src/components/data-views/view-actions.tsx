"use client";

import { Button } from "@/components/ui/button";
import type { DataViewAction } from "@/lib/agents/types";

interface ViewActionsProps {
  actions: DataViewAction[];
  onAction: (actionId: string, params?: Record<string, unknown>) => void;
}

export function ViewActions({ actions, onAction }: ViewActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2">
      {actions.map((action) => (
        <Button
          key={action.handler}
          onClick={() => onAction(action.handler, action.params)}
          variant={
            action.type === "primary"
              ? "default"
              : action.type === "danger"
                ? "destructive"
                : "outline"
          }
          size="sm"
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
