"use client";

import type { DataViewType } from "@/lib/agents/types";

interface LoadingStateProps {
  viewType?: DataViewType;
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`bg-zinc-800 rounded animate-pulse ${className || ""}`}
    />
  );
}

function ConversationSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBar className="h-2 w-32 mb-4" />
      <div className="flex justify-start">
        <SkeletonBar className="h-16 w-3/4 rounded-2xl rounded-bl-md" />
      </div>
      <div className="flex justify-end">
        <SkeletonBar className="h-10 w-1/2 rounded-2xl rounded-br-md" />
      </div>
      <div className="flex justify-start">
        <SkeletonBar className="h-16 w-2/3 rounded-2xl rounded-bl-md" />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      <SkeletonBar className="h-1.5 w-full mb-3" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 px-3">
          <SkeletonBar className="w-4 h-4 rounded" />
          <SkeletonBar className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 py-3 px-3">
          <SkeletonBar className="w-8 h-8 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBar className="h-4 w-2/3" />
            <SkeletonBar className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DefaultSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-emerald-400" />
    </div>
  );
}

export function LoadingState({ viewType }: LoadingStateProps) {
  switch (viewType) {
    case "conversation":
      return <ConversationSkeleton />;
    case "list":
      return <ListSkeleton />;
    case "recommendations":
      return <RecommendationsSkeleton />;
    default:
      return <DefaultSkeleton />;
  }
}
