"use client";

import ReactMarkdown from "react-markdown";
import type { DataViewPayloads } from "@/lib/agents/types";

interface DocumentViewProps {
  data: DataViewPayloads["document"];
}

export function DocumentView({ data }: DocumentViewProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-code:bg-zinc-800 prose-code:text-emerald-400 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
      <ReactMarkdown>{data.content_md}</ReactMarkdown>
    </div>
  );
}
