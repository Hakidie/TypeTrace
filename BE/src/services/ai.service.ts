import { chatbotConfig } from '../config/chatbot';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

/** `model` is the assistant side of the conversation (Gemini calls it `model` too). */
export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const isAiConfigured = Boolean(env.geminiApiKey);

if (!isAiConfigured) {
  console.warn('Warning: GEMINI_API_KEY is not set. The AI chat answers 503 until it is.');
}

const toAppError = (status: number, detail: string) => {
  if (status === 429) {
    return new AppError(429, 'The AI quota is used up for now. Wait a minute and try again.');
  }
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return new AppError(503, 'The AI is not set up correctly. Check GEMINI_API_KEY and GEMINI_MODEL in BE/.env.');
  }
  console.error('Gemini request failed:', status, detail);
  return new AppError(502, 'The AI did not answer. Please try again.');
};

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

interface GeminiRequest {
  systemPrompt: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  /** Stops waiting after this many milliseconds (504). Without it, the request waits as long as Gemini takes. */
  timeoutMs?: number;
}

/** One `generateContent` call: the text of the answer, '' when Gemini sends none. Failures are `AppError`s. */
const callGemini = async ({ systemPrompt, messages, maxOutputTokens, timeoutMs }: GeminiRequest): Promise<string> => {
  if (!env.geminiApiKey) {
    throw new AppError(503, 'The AI chat is not configured. Set GEMINI_API_KEY in BE/.env.');
  }

  const response = await fetch(`${GEMINI_API_URL}/${encodeURIComponent(env.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.geminiApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
      generationConfig: { maxOutputTokens }
    }),
    ...(timeoutMs && { signal: AbortSignal.timeout(timeoutMs) })
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'TimeoutError') throw new AppError(504, 'The AI took too long to answer.');
    console.error('Gemini request failed:', error);
    throw new AppError(502, 'The AI did not answer. Please try again.');
  });

  if (!response.ok) throw toAppError(response.status, await response.text());

  const data = (await response.json()) as GeminiResponse;
  return (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('').trim();
};

/**
 * Sends the conversation (latest messages only) to Gemini `generateContent` and returns the reply text. `systemPrompt`
 * gives another voice than the chat bot's (Ping, the tutorial coach).
 */
export const generateChatReply = async (messages: ChatMessage[], systemPrompt = chatbotConfig.systemPrompt): Promise<string> => {
  const text = await callGemini({
    systemPrompt,
    messages: messages.slice(-chatbotConfig.historyLimit),
    maxOutputTokens: chatbotConfig.maxReplyTokens
  });
  return text || chatbotConfig.emptyReplyFallback;
};

/**
 * One prompt, one answer (the Weak spots passage, US3.2): '' when Gemini sends no text. With `timeoutMs`, a slow answer
 * is an `AppError` (504) like every other failure, so the caller can fall back.
 */
export const generateText = (
  prompt: string,
  { systemPrompt, maxOutputTokens, timeoutMs }: { systemPrompt: string; maxOutputTokens: number; timeoutMs?: number }
) => callGemini({ systemPrompt, messages: [{ role: 'user', text: prompt }], maxOutputTokens, timeoutMs });
