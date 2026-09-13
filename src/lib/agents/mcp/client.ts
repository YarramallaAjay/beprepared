/**
 * Minimal MCP (Model Context Protocol) client.
 * HTTP-based implementation for calling MCP server tools.
 */

export interface MCPToolResult {
  content: unknown;
  isError?: boolean;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * List available tools from an MCP server.
 */
export async function listMCPTools(
  serverUrl: string,
  authToken?: string
): Promise<MCPToolInfo[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${serverUrl}/tools/list`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
  });

  if (!response.ok) {
    throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.result?.tools || [];
}

/**
 * Call a tool on an MCP server.
 */
export async function callMCPTool(
  serverUrl: string,
  toolName: string,
  params: Record<string, unknown>,
  authToken?: string
): Promise<MCPToolResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${serverUrl}/tools/call`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      id: 1,
      params: {
        name: toolName,
        arguments: params,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP tool call failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    return { content: data.error.message, isError: true };
  }

  return { content: data.result?.content || data.result };
}
