"use client";

import type { DataViewPayloads } from "@/lib/agents/types";

interface NotificationsViewProps {
  data: DataViewPayloads["notifications"];
}

export function NotificationsView({ data }: NotificationsViewProps) {
  const levelColors = {
    info: "border-l-blue-400",
    success: "border-l-emerald-400",
    warning: "border-l-yellow-400",
    error: "border-l-red-400",
  };

  return (
    <div className="space-y-2">
      {data.unread_count > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          {data.unread_count} unread
        </p>
      )}
      {data.items.map((item) => (
        <div
          key={item.id}
          className={`border-l-2 ${levelColors[item.level]} bg-gray-800/50 rounded-r-lg px-4 py-3 ${
            !item.read ? "bg-gray-800" : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-sm font-medium">{item.title}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(item.timestamp).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{item.message}</p>
          {item.action_url && (
            <a
              href={item.action_url}
              className="text-xs text-emerald-400 hover:underline mt-1 inline-block"
            >
              View
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
