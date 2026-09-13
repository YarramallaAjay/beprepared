"use client";

import type { DataViewPayloads } from "@/lib/agents/types";

interface ImageViewProps {
  data: DataViewPayloads["image"];
}

export function ImageView({ data }: ImageViewProps) {
  return (
    <figure className="space-y-2">
      <img
        src={data.url}
        alt={data.alt || "Image"}
        className="w-full rounded-lg"
      />
      {data.caption && (
        <figcaption className="text-xs text-muted-foreground text-center">
          {data.caption}
        </figcaption>
      )}
    </figure>
  );
}
