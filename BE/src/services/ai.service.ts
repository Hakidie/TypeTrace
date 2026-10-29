import { chatbotConfig } from '../config/chatbot';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

/** `model` is the assistant side of the conversation (OpenAI calls it `assistant`). */
export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export const isAiConfigured = Boolean(env.openaiApiKey);

if (!isAiConfigured) {
  console.warn('Warning: OPENAI_API_KEY is not set. The AI chat answers 503 until it is.');
}

const toAppError = (status: number, detail: string) => {
  if (status === 429) {
    return new AppError(429, 'The AI quota is used up for now. Wait a minute and try again.');
  }
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return new AppError(503, 'The AI is not set up correctly. Check OPENAI_API_KEY and OPENAI_MODEL in BE/.env.');
  }
  console.error('OpenAI request failed:', status, detail);
  return new AppError(502, 'The AI did not answer. Please try again.');
};

/**
 * Sends the conversation (latest messages only) to OpenAI Chat Completions and returns the reply text. `systemPrompt`
 * gives another voice than the chat bot's (Ping, the tutorial coach).
 */
export const generateChatReply = async (messages: ChatMessage[], systemPrompt = chatbotConfig.systemPrompt): Promise<string> => {
  if (!isAiConfigured) {
    throw new AppError(503, 'The AI chat is not configured. Set OPENAI_API_KEY in BE/.env.');
  }

  const history = messages.slice(-chatbotConfig.historyLimit).map((message) => ({
    role: message.role === 'model' ? 'assistant' : 'user',
    content: message.text
  }));

  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.openaiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.openaiModel,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      max_completion_tokens: chatbotConfig.maxReplyTokens
    })
  }).catch((error: unknown) => {
    console.error('OpenAI request failed:', error);
    throw new AppError(502, 'The AI did not answer. Please try again.');
  });

  if (!response.ok) throw toAppError(response.status, await response.text());

  const data = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  return data.choices?.[0]?.message?.content?.trim() || chatbotConfig.emptyReplyFallback;
};
