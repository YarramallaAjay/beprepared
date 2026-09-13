"use client";

import { Fragment } from "react";

interface PipelineStep {
  slug: string;
  label: string;
  status: "completed" | "running" | "pending";
}

interface PipelineStatusProps {
  steps: PipelineStep[];
}

export function PipelineStatus({ steps }: PipelineStatusProps) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {steps.map((step, i) => (
        <Fragment key={step.slug}>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
              step.status === "completed"
                ? "bg-emerald-600/20 text-emerald-400"
                : step.status === "running"
                  ? "bg-amber-600/20 text-amber-400"
                  : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {step.status === "completed" && "✓ "}
            {step.status === "running" && (
              <span className="inline-block w-3 h-3 border-t-2 border-current rounded-full animate-spin" />
            )}
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <span className="text-zinc-600">→</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
