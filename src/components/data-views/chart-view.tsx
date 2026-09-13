"use client";

import type { DataViewPayloads } from "@/lib/agents/types";

interface ChartViewProps {
  data: DataViewPayloads["chart"];
}

export function ChartView({ data }: ChartViewProps) {
  const maxValue = Math.max(...data.data.map((d) => d.value), 1);

  // Simple bar chart implementation (no external charting library)
  if (data.chart_type === "bar" || data.chart_type === "area") {
    return (
      <div className="space-y-2">
        {data.y_label && (
          <p className="text-xs text-muted-foreground">{data.y_label}</p>
        )}
        {data.data.map((point) => (
          <div key={point.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-24 text-right truncate">
              {point.label}
            </span>
            <div className="flex-1 bg-gray-800 rounded h-6 overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${(point.value / maxValue) * 100}%`,
                  backgroundColor: point.color || "#34d399",
                }}
              />
            </div>
            <span className="text-xs font-mono w-12 text-right">{point.value}</span>
          </div>
        ))}
        {data.x_label && (
          <p className="text-xs text-muted-foreground text-center mt-2">{data.x_label}</p>
        )}
      </div>
    );
  }

  // Pie chart: show as percentage list
  const total = data.data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="space-y-2">
      {data.data.map((point) => {
        const pct = total > 0 ? Math.round((point.value / total) * 100) : 0;
        return (
          <div key={point.label} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: point.color || "#34d399" }}
            />
            <span className="text-sm flex-1">{point.label}</span>
            <span className="text-sm font-mono">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
