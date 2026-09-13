"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DataViewPayloads } from "@/lib/agents/types";

interface FeedViewProps {
  data: DataViewPayloads["feed"];
}

export function FeedView({ data }: FeedViewProps) {
  return (
    <div className="space-y-3">
      {data.items.map((item) => (
        <Card key={item.id}>
          <CardContent className="py-3 px-4">
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-40 object-cover rounded-md mb-3"
              />
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <span className="text-sm font-medium">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-emerald-400">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </span>
                {item.author && (
                  <span className="text-xs text-muted-foreground ml-2">by {item.author}</span>
                )}
              </div>
              {item.timestamp && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
              )}
            </div>
            {item.content && (
              <p className="text-xs text-muted-foreground mt-1">{item.content}</p>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
