/**
 * Validates an agent definition submitted as YAML/JSON.
 * This is the schema users must conform to when submitting custom agents.
 */

export interface AgentYAMLSchema {
  identity: {
    slug: string;
    name: string;
    description: string;
    version: string;
    author: string;
  };
  config?: {
    fields?: {
      key: string;
      label: string;
      type: "string" | "number" | "boolean" | "select" | "multiselect" | "text";
      default?: unknown;
      required?: boolean;
      options?: { label: string; value: string }[];
      description?: string;
    }[];
  };
  permissions?: {
    resource: string;
    actions: string[];
  }[];
  tools?: {
    name: string;
    required: boolean;
  }[];
  mcp_connections?: {
    server_url: string;
    name: string;
    auth_type?: string;
    tools?: string[];
  }[];
  data_view_type: string;
  execution?: {
    mode: "scheduled" | "event_triggered" | "on_demand";
    schedule?: string;
    event_triggers?: string[];
  };
  instructions: {
    system_prompt: string;
    execution_steps: ExecutionStep[];
    render_template?: {
      type: string;
      map: Record<string, unknown>;
    };
  };
}

export interface ExecutionStep {
  tool?: string;
  query?: string;
  output?: string;
  llm?: string;
  input?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_DATA_VIEW_TYPES = [
  "feed", "list", "table", "chart", "embed", "document",
  "image", "recommendations", "notifications", "summary",
  "conversation", "calendar",
];

const VALID_TOOLS = ["web_search", "youtube_search", "scrape_url", "mcp"];

const ALLOWED_PERMISSIONS = [
  "profiles", "social_profiles", "character_documents",
  "preferred_sources", "content_items",
];

export function validateAgentSchema(schema: AgentYAMLSchema): ValidationResult {
  const errors: string[] = [];

  // Identity validation
  if (!schema.identity) {
    errors.push("identity is required");
  } else {
    if (!schema.identity.slug || !/^[a-z0-9-]+$/.test(schema.identity.slug)) {
      errors.push("identity.slug must be lowercase alphanumeric with hyphens");
    }
    if (schema.identity.slug?.startsWith("system-")) {
      errors.push("identity.slug cannot start with 'system-'");
    }
    if (!schema.identity.name) errors.push("identity.name is required");
    if (!schema.identity.description) errors.push("identity.description is required");
    if (!schema.identity.version) errors.push("identity.version is required");
    if (!schema.identity.author) errors.push("identity.author is required");
  }

  // Data view type
  if (!schema.data_view_type) {
    errors.push("data_view_type is required");
  } else if (!VALID_DATA_VIEW_TYPES.includes(schema.data_view_type)) {
    errors.push(`data_view_type must be one of: ${VALID_DATA_VIEW_TYPES.join(", ")}`);
  }

  // Tools validation
  if (schema.tools) {
    for (const tool of schema.tools) {
      if (!VALID_TOOLS.includes(tool.name)) {
        errors.push(`Unknown tool: ${tool.name}. Valid tools: ${VALID_TOOLS.join(", ")}`);
      }
    }
  }

  // Permissions validation
  if (schema.permissions) {
    for (const perm of schema.permissions) {
      if (!ALLOWED_PERMISSIONS.includes(perm.resource)) {
        errors.push(`Permission denied for resource: ${perm.resource}`);
      }
      if (perm.actions.includes("delete")) {
        errors.push(`Custom agents cannot have delete permission on ${perm.resource}`);
      }
    }
  }

  // Instructions validation
  if (!schema.instructions) {
    errors.push("instructions is required");
  } else {
    if (!schema.instructions.system_prompt) {
      errors.push("instructions.system_prompt is required");
    }
    if (!schema.instructions.execution_steps || schema.instructions.execution_steps.length === 0) {
      errors.push("instructions.execution_steps must have at least one step");
    }
  }

  // Execution mode validation
  if (schema.execution) {
    const validModes = ["scheduled", "event_triggered", "on_demand"];
    if (!validModes.includes(schema.execution.mode)) {
      errors.push(`execution.mode must be one of: ${validModes.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
