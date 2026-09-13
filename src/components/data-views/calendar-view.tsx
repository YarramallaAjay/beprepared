"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DataViewPayloads } from "@/lib/agents/types";

interface CalendarViewProps {
  data: DataViewPayloads["calendar"];
}

export function CalendarView({ data }: CalendarViewProps) {
  // Group events by date
  const grouped = new Map<string, typeof data.events>();
  for (const event of data.events) {
    const date = event.date;
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(event);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([date, events]) => (
        <div key={date}>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            {new Date(date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h4>
          <div className="space-y-1">
            {events.map((event) => (
              <Card key={event.id}>
                <CardContent className="py-2 px-3 flex items-center gap-3">
                  {event.time && (
                    <span className="text-xs font-mono text-muted-foreground w-14">
                      {event.time}
                    </span>
                  )}
                  <span className="text-sm flex-1">{event.title}</span>
                  {event.duration_minutes && (
                    <span className="text-xs text-muted-foreground">
                      {event.duration_minutes}m
                    </span>
                  )}
                  {event.status && (
                    <Badge variant="secondary" className="text-xs">
                      {event.status}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
