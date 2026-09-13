import type { AgentDefinition } from "./types";

const registry = new Map<string, AgentDefinition>();

export function registerAgent(definition: AgentDefinition): void {
  const slug = definition.identity.slug;
  if (registry.has(slug)) {
    console.warn(`[AgentRegistry] Overwriting agent: ${slug}`);
  }
  registry.set(slug, definition);
  console.log(`[AgentRegistry] Registered: ${slug} v${definition.identity.version}`);
}

export function getAgentDefinition(slug: string): AgentDefinition {
  const def = registry.get(slug);
  if (!def) throw new Error(`Agent not found: ${slug}`);
  return def;
}

export function getAllAgentDefinitions(): AgentDefinition[] {
  return Array.from(registry.values());
}

export function getAgentsByCategory(category: string): AgentDefinition[] {
  return getAllAgentDefinitions().filter((d) => d.identity.category === category);
}

export function hasAgent(slug: string): boolean {
  return registry.has(slug);
}
