import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { grantPremium } from '../../src/services/subscription.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const at = (iso: string) => vi.setSystemTime(new Date(iso));
const stats = (auth: string, query: string) => api().get(`/api/admin/plans/users-over-time${query}`).set('Authorization', auth);
const counts = (body: { points: { key: string; free: number; premium: number }[] }) => body.points.map((point) => [point.key, point.free, point.premium]);

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

// Vietnam time. The admin, An and Binh join on 1 January, Chi on 20 January; An has Premium from 10 January to 10 February.
const setup = async () => {
  at('2026-01-01T03:00:00Z');
  const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
  const an = await createUser({ email: 'an@example.com' });
  await createUser({ email: 'binh@example.com' });
  at('2026-01-10T03:00:00Z');
  await grantPremium(String(an._id), 1, String(admin._id));
  at('2026-01-20T03:00:00Z');
  await createUser({ email: 'chi@example.com' });
  at('2026-02-15T03:00:00Z');
  return bearerFor(admin);
};

describe('GET /api/admin/plans/users-over-time', () => {
  it('counts the users on each plan at the end of each block of a month, up to now', async () => {
    const auth = await setup();

    const res = await stats(auth, '?range=month&date=2026-01-15');

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('month');
    expect(counts(res.body)).toEqual([
      ['2026-01-01', 3, 0],
      ['2026-01-08', 2, 1],
      ['2026-01-15', 3, 1],
      ['2026-01-22', 3, 1],
      ['2026-01-29', 3, 1]
    ]);
  });

  it('counts by month for a year: the current month is counted as of now and the months to come are left out', async () => {
    const auth = await setup();

    const res = await stats(auth, '?range=year&date=2026-01-15');

    expect(counts(res.body)).toEqual([
      ['2026-01', 3, 1],
      // An's Premium ended on 10 February.
      ['2026-02', 4, 0]
    ]);
  });

  it('counts by day for a week', async () => {
    const auth = await setup();

    const res = await stats(auth, '?range=week&date=2026-01-08');

    expect(counts(res.body).slice(0, 3)).toEqual([
      ['2026-01-08', 3, 0],
      ['2026-01-09', 3, 0],
      ['2026-01-10', 2, 1]
    ]);
    expect(res.body.points).toHaveLength(7);
  });

  it('refuses a learner, a guest and a range it does not know', async () => {
    const auth = await setup();
    const learner = await createUser({ email: 'learner@example.com' });

    expect((await stats(bearerFor(learner), '?range=year')).status).toBe(403);
    expect((await api().get('/api/admin/plans/users-over-time')).status).toBe(401);
    expect((await stats(auth, '?range=decade')).status).toBe(400);
  });
});
