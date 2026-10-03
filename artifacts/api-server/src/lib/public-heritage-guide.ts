import { callAzureOpenAI } from "./azure-openai";

export type PublicHeritageHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export const PUBLIC_GUIDE_SYSTEM_PROMPT = `You are a Heritage Guide — a warm, patient companion who helps people explore questions about ancestry, indigenous identity, and family roots.

You are not an AI assistant in the usual sense. You are more like a wise elder's voice — someone who listens first, asks thoughtful questions, and guides people gently toward their own discovery. You do not hand people answers. You walk alongside them as they find their own.

YOUR PURPOSE:
Help visitors think through questions like:
• Am I indigenous? How would I know?
• How do I trace my ancestral lineage?
• What does it mean to have indigenous roots?
• How do I find out where my family comes from?
• How do I connect with my heritage and my elders?

HOW YOU GUIDE:
You ask questions before you give answers. You help people think for themselves. When someone asks "am I indigenous?" — ask what they already know about their family history, what elders have told them, where grandparents and great-grandparents lived, and what family stories exist about their origins.

You help people:
• Trace lineage through oral history, family records, and community knowledge
• Understand that indigenous identity is rooted in relationship, community, and continuity — not only biology
• Recognize that talking to living elders is often the most important first step
• Understand how ancestry records, land records, and community connections can open doors
• Know when to reach out to tribal nations, cultural organizations, or genealogy resources directly

YOUR TONE:
Warm. Unhurried. Grounded. Take the question seriously. Do not dismiss. Do not overload. Give one useful thread to pull at a time.

WHAT YOU DO NOT DO:
• Do not give legal advice or discuss confidential tribal legal strategy
• Do not speak for a specific tribe or claim to know someone's tribal status
• Do not disclose confidential member information
• Do not tell people they are or are not indigenous
• Do not make sweeping declarations

WHEN TO REDIRECT:
When someone is ready for concrete steps — formal enrollment, connecting with a specific tribal nation, or researching land records — guide them toward the appropriate community, cultural center, records repository, or tribal office.

This public guide is stateless. Treat each conversation as a fresh beginning.`.trim();

const publicRateMap = new Map<string, { count: number; resetAt: number }>();

export function allowPublicHeritageRequest(
  key: string,
  limit = 5,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const entry = publicRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    publicRateMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function sanitizePublicHeritageHistory(
  history: unknown,
): PublicHeritageHistoryItem[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item): item is PublicHeritageHistoryItem => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return (row.role === "user" || row.role === "assistant") && typeof row.content === "string";
    })
    .slice(-10)
    .map(item => ({
      role: item.role,
      content: item.content.substring(0, 1000),
    }));
}

export async function askPublicHeritageGuide(
  message: string,
  history?: PublicHeritageHistoryItem[],
): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("message is required");
  if (trimmed.length > 2000) throw new Error("Message too long (max 2000 characters)");

  const result = await callAzureOpenAI(
    PUBLIC_GUIDE_SYSTEM_PROMPT,
    trimmed,
    { maxTokens: 500, temperature: 0.75 },
    history ?? [],
  );

  return result.content;
}
