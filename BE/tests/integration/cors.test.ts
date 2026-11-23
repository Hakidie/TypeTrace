import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api';

const ORIGIN = 'http://localhost:5173';

const preflight = (origin: string) =>
  api().options('/api/sessions').set('Origin', origin).set('Access-Control-Request-Method', 'POST');

describe('CORS preflight', () => {
  it('answers the preflight with a max age so browsers cache it', async () => {
    const response = await preflight(ORIGIN);

    expect(response.status).toBe(204);
    expect(response.headers['access-control-max-age']).toBe('86400');
    expect(response.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('does not allow another origin', async () => {
    const response = await preflight('https://evil.example');

    expect(response.headers['access-control-allow-origin']).toBe(ORIGIN); // never the caller's origin, so the browser refuses it
  });
});
