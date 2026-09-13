// ============================================================
// AGENT IDENTITY & CONFIGURATION
// ============================================================

export type AgentCategory = "builtin" | "custom" | "marketplace";
export type AgentStatus = "draft" | "active" | "deprecated" | "disabled";
export type ExecutionMode = "scheduled" | "event_triggered" | "on_demand";
export type TriggerType = "manual" | "scheduled" | "event" | "system" | "pipeline";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type UserAgentStatus = "active" | "paused" | "error" | "configuring";

export interface AgentIdentity {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: AgentCategory;
  icon?: string;
  color?: string;
}

export interface AgentConfigField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "multiselect" | "text";
  default?: unknown;
  required?: boolean;
  options?: { label: string; value: string }[];
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface AgentPermission {
  resource: string;
  actions: ("read" | "write" | "delete")[];
}

export interface AgentToolSpec {
  name: string;
  required: boolean;
  config?: Record<string, unknown>;
}

export interface MCPConnection {
  server_url: string;
  name: string;
  auth_type?: "none" | "bearer" | "api_key";
  tools?: string[];
}

// ============================================================
// DATA VIEW TYPES
// ============================================================

export type DataViewType =
  | "feed"
  | "list"
  | "table"
  | "chart"
  | "embed"
  | "document"
  | "image"
  | "recommendations"
  | "notifications"
  | "summary"
  | "conversation"
  | "calendar";

export interface DataViewAction {
  label: string;
  type: "primary" | "secondary" | "danger";
  handler: string;
  params?: Record<string, unknown>;
}

export interface FeedItem {
  id: string;
  title: string;
  content?: string;
  url?: string;
  image_url?: string;
  author?: string;
  timestamp?: string;
  tags?: string[];
  actions?: DataViewAction[];
  metadata?: Record<string, unknown>;
}

export interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: "pending" | "completed" | "skipped" | "in_progress";
  badge?: { text: string; variant: "default" | "success" | "warning" | "error" };
  url?: string;
  actions?: DataViewAction[];
  metadata?: Record<string, unknown>;
}

export interface TableColumn {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "badge" | "link" | "progress";
  sortable?: boolean;
  width?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface EmbedData {
  url: string;
  title?: string;
  embed_type: "iframe" | "video" | "audio";
}

export interface DocumentData {
  content_md: string;
  title?: string;
}

export interface ImageData {
  url: string;
  alt?: string;
  caption?: string;
}

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  url?: string;
  content_type?: string;
  estimated_minutes?: number;
  priority: number;
  source?: string;
  tags?: string[];
  actions?: DataViewAction[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
  action_url?: string;
}

export interface SummarySection {
  heading: string;
  content: string;
  metric?: { value: string; label: string };
}

export interface ConversationOption {
  id: string;
  label: string;
  description?: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  options?: ConversationOption[];
  metadata?: Record<string, unknown>;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  duration_minutes?: number;
  status?: string;
  description?: string;
}

// Data view payload per type
export interface DataViewPayloads {
  feed: { items: FeedItem[]; has_more?: boolean };
  list: { items: ListItem[]; grouped_by?: string; groups?: { label: string; items: ListItem[] }[] };
  table: { columns: TableColumn[]; rows: Record<string, unknown>[]; total_count?: number };
  chart: { chart_type: "bar" | "line" | "pie" | "area"; data: ChartDataPoint[]; x_label?: string; y_label?: string };
  embed: EmbedData;
  document: DocumentData;
  image: ImageData;
  recommendations: { items: RecommendationItem[]; summary?: string };
  notifications: { items: NotificationItem[]; unread_count: number };
  summary: { title: string; sections: SummarySection[] };
  conversation: { messages: ConversationMessage[]; input_placeholder?: string; interactive?: boolean };
  calendar: { events: CalendarEvent[]; view: "day" | "week" | "month" };
}

// The DataView object agents produce
export interface DataView<T extends DataViewType = DataViewType> {
  type: T;
  title: string;
  subtitle?: string;
  data: DataViewPayloads[T];
  actions?: DataViewAction[];
  empty_state?: {
    title: string;
    description: string;
    action?: DataViewAction;
  };
  metadata?: Record<string, unknown>;
  updated_at: string;
}

// ============================================================
// AGENT CONTEXT (provided at execution time)
// ============================================================

export interface AgentLLMService {
  chat(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    options?: { temperature?: number; max_tokens?: number; json_mode?: boolean }
  ): Promise<string>;

  chatJson<T = unknown>(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<T>;
}

export interface AgentStorageService {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<{ key: string; value: unknown }[]>;
}

export interface AgentToolService {
  searchWeb(query: string, limit?: number): Promise<{ title: string; url: string; snippet: string }[]>;
  searchYouTube(query: string, limit?: number): Promise<{ title: string; url: string; description: string; author?: string; duration?: string }[]>;
  callMCP(serverName: string, toolName: string, params: Record<string, unknown>): Promise<unknown>;
}

export interface AgentDBService {
  getProfile(): Promise<Record<string, unknown> | null>;
  getCharacterDoc(): Promise<string | null>;
  getPreferredSources(): Promise<{ source_name: string; source_type: string; source_url?: string }[]>;
  query(table: string, filters: Record<string, unknown>): Promise<unknown[]>;
}

export interface AgentContext {
  userId: string;
  userConfig: Record<string, unknown>;
  agentSlug: string;
  runId: string;
  llm: AgentLLMService;
  storage: AgentStorageService;
  tools: AgentToolService;
  db: AgentDBService;
}

// ============================================================
// AGENT DEFINITION (the contract every agent implements)
// ============================================================

export interface AgentDefinition {
  identity: AgentIdentity;
  configFields: AgentConfigField[];
  permissions: AgentPermission[];
  tools: AgentToolSpec[];
  mcpConnections: MCPConnection[];
  dataViewType: DataViewType;
  defaultExecutionMode: ExecutionMode;
  defaultSchedule?: string;
  defaultEventTriggers?: string[];

  validate(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }>;
  execute(ctx: AgentContext): Promise<Record<string, unknown>>;
  render(data: Record<string, unknown>, ctx: AgentContext): Promise<DataView>;

  onInstall?(ctx: AgentContext): Promise<void>;
  onUninstall?(ctx: AgentContext): Promise<void>;
  onConfigChange?(oldConfig: Record<string, unknown>, newConfig: Record<string, unknown>, ctx: AgentContext): Promise<void>;
  handleAction?(actionId: string, params: Record<string, unknown>, ctx: AgentContext): Promise<DataView | void>;
}
