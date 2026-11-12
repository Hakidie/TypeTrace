import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ai service without an API key', () => {
  afterEach(() => {
    vi.doUnmock('../../src/config/env');
    vi.resetModules();
  });

  it('answers 503 with what to configure, without calling Gemini', async () => {
    vi.resetModules();
    const actual = await vi.importActual<typeof import('../../src/config/env')>('../../src/config/env');
    vi.doMock('../../src/config/env', () => ({ env: { ...actual.env, geminiApiKey: undefined } }));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { generateChatReply, isAiConfigured } = await import('../../src/services/ai.service');

    expect(isAiConfigured).toBe(false);
    await expect(generateChatReply([{ role: 'user', text: 'Hi' }])).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('GEMINI_API_KEY')
    });
  });
});
