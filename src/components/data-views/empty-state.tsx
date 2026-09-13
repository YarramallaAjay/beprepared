"use client";

import { Button } from "@/components/ui/button";
import type { DataViewAction } from "@/lib/agents/types";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: DataViewAction;
  onAction?: (actionId: string, params?: Record<string, unknown>) => void;
}

export function EmptyState({ title, description, action, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Geometric illustration */}
      <div className="relative w-16 h-16 mb-5">
        <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 rotate-12" />
        <div className="absolute inset-1 rounded-2xl bg-emerald-500/10 -rotate-6" />
        <div className="absolute inset-2 rounded-2xl bg-emerald-500/20 rotate-3 flex items-center justify-center">
          <span className="text-emerald-400 text-lg">?</span>
        </div>
      </div>
      <h3 className="text-base font-semibold text-gray-200">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
        {description}
      </p>
      {action && onAction && (
        <Button
          onClick={() => onAction(action.handler, action.params)}
          className={`mt-5 ${
            action.type === "danger"
              ? ""
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
          variant={action.type === "danger" ? "destructive" : "default"}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
