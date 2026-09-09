import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "STFU BePrepared",
      },
    });
  }
  return client;
}

export async function callOpenRouter(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: { temperature?: number; max_tokens?: number; response_format?: { type: string } }
): Promise<string> {
  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 4096,
    ...(options?.response_format ? { response_format: options.response_format as OpenAI.ChatCompletionCreateParams["response_format"] } : {}),
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response content from OpenRouter");
  return content;
}
