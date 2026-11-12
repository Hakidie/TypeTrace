import { describe, expect, it } from 'vitest';
import { pingCoach } from '../../src/config/ping-coach';
import { api } from '../helpers/api';
import { geminiRecorder } from '../helpers/gemini-recorder';
import { bearerFor, createUser } from '../helpers/user-factory';

const STATS = { result: 'win', hits: 19, thrown: 7, livesLeft: 3, seconds: 74, missedWords: ['river', 'stone'] };
const coach = (auth: string | undefined, body: unknown) => {
  const request = api().post('/api/tutorial/coach');
  if (auth) request.set('Authorization', auth);
  return request.send(body as object);
};

describe('POST /api/tutorial/coach', () => {
  it('asks Gemini as Ping, with the numbers of the match', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await coach(auth, STATS);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tip: 'Hello from the test model', ai: true });
    const sent = geminiRecorder.requests[0] as {
      systemInstruction: unknown;
      contents: { role: string; parts: { text: string }[] }[];
    };
    expect(sent.systemInstruction).toEqual({ parts: [{ text: pingCoach.systemPrompt }] });
    expect(sent.contents[0].role).toBe('user');
    expect(sent.contents[0].parts[0].text).toContain('19');
    expect(sent.contents[0].parts[0].text).toContain('river');
  });

  it.each([429, 401, 500])('falls back to a written tip when Gemini answers %i', async (status) => {
    geminiRecorder.errorStatus = status;
    const auth = bearerFor(await createUser({}));
    const errorLog = console.error;
    console.error = () => undefined;

    const response = await coach(auth, { ...STATS, result: 'loss', livesLeft: 0 });
    console.error = errorLog;

    expect(response.status).toBe(200);
    expect(response.body.ai).toBe(false);
    expect(response.body.tip.length).toBeGreaterThan(10);
  });

  it('takes Vietnamese words', async () => {
    const auth = bearerFor(await createUser({}));

    expect((await coach(auth, { ...STATS, missedWords: ['trường', 'đèn'] })).status).toBe(200);
  });

  it('validates the numbers', async () => {
    const auth = bearerFor(await createUser({}));

    expect((await coach(auth, { ...STATS, livesLeft: 4 })).status).toBe(400);
    expect((await coach(auth, { ...STATS, result: 'forfeit' })).status).toBe(400);
    expect((await coach(auth, { ...STATS, missedWords: ['<b>hi</b>'] })).status).toBe(400);
    expect((await coach(auth, { ...STATS, missedWords: Array(11).fill('moon') })).status).toBe(400);
    expect(geminiRecorder.requests).toHaveLength(0);
  });

  it('requires authentication', async () => {
    expect((await coach(undefined, STATS)).status).toBe(401);
  });
});
