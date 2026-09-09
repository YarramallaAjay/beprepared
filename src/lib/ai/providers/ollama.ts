export async function callOllama(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: { temperature?: number; max_tokens?: number; response_format?: { type: string } }
): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    options: {
      temperature: options?.temperature ?? 0.7,
      num_predict: options?.max_tokens ?? 2048,
    },
  };

  if (options?.response_format?.type === "json_object") {
    body.format = "json";
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const content = data.message?.content;
  if (!content) throw new Error("No response content from Ollama");
  return content;
}
