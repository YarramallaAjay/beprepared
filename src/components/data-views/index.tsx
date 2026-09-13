"use client";

import type { DataView, DataViewType } from "@/lib/agents/types";
import { EmptyState } from "./empty-state";
import { ViewActions } from "./view-actions";
import { FeedView } from "./feed-view";
import { ListView } from "./list-view";
import { TableView } from "./table-view";
import { ChartView } from "./chart-view";
import { EmbedView } from "./embed-view";
import { DocumentView } from "./document-view";
import { ImageView } from "./image-view";
import { RecommendationsView } from "./recommendations-view";
import { NotificationsView } from "./notifications-view";
import { SummaryView } from "./summary-view";
import { ConversationView } from "./conversation-view";
import { CalendarView } from "./calendar-view";
import { LoadingState } from "./loading-state";

interface DataViewRendererProps {
  view: DataView;
  onAction?: (actionId: string, params?: Record<string, unknown>) => void;
  compact?: boolean;
  loading?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const VIEW_COMPONENTS: Record<DataViewType, React.ComponentType<{ data: any; onAction?: DataViewRendererProps["onAction"] }>> = {
  feed: FeedView,
  list: ListView,
  table: TableView,
  chart: ChartView,
  embed: EmbedView,
  document: DocumentView,
  image: ImageView,
  recommendations: RecommendationsView,
  notifications: NotificationsView,
  summary: SummaryView,
  conversation: ConversationView,
  calendar: CalendarView,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

function isViewEmpty(view: DataView): boolean {
  const d = view.data;
  if (!d) return true;
  if ("items" in d && Array.isArray(d.items) && d.items.length === 0) return true;
  if ("messages" in d && Array.isArray(d.messages) && d.messages.length === 0) return true;
  if ("events" in d && Array.isArray(d.events) && d.events.length === 0) return true;
  if ("rows" in d && Array.isArray(d.rows) && d.rows.length === 0) return true;
  if ("sections" in d && Array.isArray(d.sections) && d.sections.length === 0) return true;
  return false;
}

export function DataViewRenderer({ view, onAction, compact, loading }: DataViewRendererProps) {
  if (loading) {
    return <LoadingState viewType={view.type} />;
  }

  const Component = VIEW_COMPONENTS[view.type];

  if (!Component) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Unsupported view type: {view.type}
      </div>
    );
  }

  if (isViewEmpty(view) && view.empty_state) {
    return (
      <EmptyState
        title={view.empty_state.title}
        description={view.empty_state.description}
        action={view.empty_state.action}
        onAction={onAction}
      />
    );
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">{view.title}</h3>
            {view.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{view.subtitle}</p>
            )}
          </div>
          {view.actions && view.actions.length > 0 && onAction && (
            <ViewActions actions={view.actions} onAction={onAction} />
          )}
        </div>
      )}
      <Component data={view.data} onAction={onAction} />
      {!compact && view.updated_at && (
        <p className="text-xs text-muted-foreground/60">
          Updated {new Date(view.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
