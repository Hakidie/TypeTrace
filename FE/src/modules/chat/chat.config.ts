/**
 * Texts of the AI chat page. Change them to match your bot. The bot's
 * personality (system prompt, thinking level, history length) is configured on the
 * backend in BE/src/config/chatbot.ts.
 */
export const chatConfig = {
  botName: 'AI Assistant',
  welcomeMessage: 'Xin chào! Mình có thể giúp gì cho bạn? / Hi! How can I help you?',
  /** Clickable example questions shown before the first message. */
  suggestions: [
    'Giải thích định luật Newton thứ hai thật ngắn gọn',
    'Give me 3 tips to study for an exam',
    'Viết một đoạn giới thiệu bản thân bằng tiếng Anh',
  ],
};
