import OpenAI from "openai";
import { logger } from "./logger";

let _client: OpenAI | null = null;
let _cachedDeployment: string | null = null;

export function getAzureOpenAIClient(): OpenAI | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    logger.warn("Azure OpenAI not configured — missing AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, or AZURE_OPENAI_DEPLOYMENT");
    return null;
  }

  if (_client && _cachedDeployment === deployment) {
    return _client;
  }

  _cachedDeployment = deployment;
  _client = new OpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}`,
    defaultQuery: { "api-version": "2024-12-01-preview" },
    defaultHeaders: { "api-key": apiKey },
  });
  logger.info({ endpoint, deployment }, "Azure OpenAI client initialized");
  return _client;
}

export function getDeployment(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT ?? "tribal-gpt4o";
}

export interface AzureOpenAIResult {
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  tier: "azure_openai";
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function callAzureOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
  conversationHistory: ConversationMessage[] = [],
): Promise<AzureOpenAIResult> {
  const client = getAzureOpenAIClient();
  if (!client) throw new Error("Azure OpenAI not configured");

  const { maxTokens = 2000, temperature = 0.2, timeoutMs = 20000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const deployment = getDeployment();
    const response = await client.chat.completions.create(
      {
        model: deployment,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
      },
      { signal: controller.signal },
    );

    const content = response.choices[0]?.message?.content ?? "";
    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    logger.info({ tokens: usage?.totalTokens, deployment }, "Azure OpenAI call succeeded");
    return { content, usage, tier: "azure_openai" };
  } finally {
    clearTimeout(timer);
  }
}
