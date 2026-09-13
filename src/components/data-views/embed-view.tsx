"use client";

import type { DataViewPayloads } from "@/lib/agents/types";

interface EmbedViewProps {
  data: DataViewPayloads["embed"];
}

export function EmbedView({ data }: EmbedViewProps) {
  if (data.embed_type === "video") {
    // Handle YouTube URLs
    const youtubeMatch = data.url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
    );
    if (youtubeMatch) {
      return (
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
            className="w-full h-full rounded-lg"
            allowFullScreen
            title={data.title || "Video"}
          />
        </div>
      );
    }
    return (
      <video controls className="w-full rounded-lg">
        <source src={data.url} />
      </video>
    );
  }

  if (data.embed_type === "audio") {
    return (
      <audio controls className="w-full">
        <source src={data.url} />
      </audio>
    );
  }

  return (
    <iframe
      src={data.url}
      className="w-full h-96 rounded-lg border border-gray-700"
      title={data.title || "Embedded content"}
    />
  );
}
