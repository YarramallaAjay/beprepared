"use client";

import { Badge } from "@/components/ui/badge";
import type { DataViewPayloads } from "@/lib/agents/types";

interface RecommendationsViewProps {
  data: DataViewPayloads["recommendations"];
  onAction?: (actionId: string, params?: Record<string, unknown>) => void;
}

const TYPE_ICONS: Record<string, string> = {
  video: "▶",
  blog: "📄",
  article: "📄",
  course: "📚",
  repo: "💻",
  documentation: "📖",
  practice: "🔧",
  tutorial: "📝",
  other: "📌",
};

export function RecommendationsView({ data, onAction }: RecommendationsViewProps) {
  // Group items by first tag if available, otherwise show flat
  const groups = new Map<string, typeof data.items>();
  for (const item of data.items) {
    const group = item.tags?.[0] || "Resources";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(item);
  }

  const hasGroups = groups.size > 1;

  return (
    <div className="space-y-4">
      {data.summary && (
        <p className="text-sm text-muted-foreground">{data.summary}</p>
      )}

      {Array.from(groups.entries()).map(([groupName, items]) => (
        <div key={groupName}>
          {hasGroups && (
            <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2 px-1">
              {groupName}
            </h4>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-3 px-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors"
              >
                {/* Content type icon */}
                <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center text-sm flex-shrink-0">
                  {TYPE_ICONS[item.content_type || "other"] || TYPE_ICONS.other}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-emerald-400"
                        >
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </span>
                    {item.content_type && (
                      <Badge variant="secondary" className="text-xs">
                        {item.content_type}
                      </Badge>
                    )}
                    {item.estimated_minutes && (
                      <span className="text-xs text-muted-foreground">
                        ~{item.estimated_minutes} min
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Priority bars */}
                <div className="flex items-end gap-0.5 flex-shrink-0 h-5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-sm ${
                        i < item.priority
                          ? "bg-emerald-400"
                          : "bg-zinc-700"
                      }`}
                      style={{ height: `${(i + 1) * 3 + 2}px` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
