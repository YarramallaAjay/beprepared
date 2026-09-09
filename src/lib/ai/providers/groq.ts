import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return client;
}

export async function callGroq(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: { temperature?: number; max_tokens?: number; response_format?: { type: string } }
): Promise<string> {
  const groq = getClient();
  const completion = await groq.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 4096,
    ...(options?.response_format ? { response_format: options.response_format as OpenAI.ChatCompletionCreateParams["response_format"] } : {}),
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response content from Groq");
  return content;
}
