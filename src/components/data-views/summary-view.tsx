"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataViewPayloads } from "@/lib/agents/types";

interface SummaryViewProps {
  data: DataViewPayloads["summary"];
}

export function SummaryView({ data }: SummaryViewProps) {
  return (
    <div className="space-y-4">
      {data.sections.map((section, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{section.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{section.content}</p>
            {section.metric && (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">
                  {section.metric.value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {section.metric.label}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
