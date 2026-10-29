import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const me = (auth: string) => api().get('/api/auth/me').set('Authorization', auth);
const start = (auth: string) => api().post('/api/tutorial/start').set('Authorization', auth);
const patch = (auth: string, body: unknown) => api().patch('/api/tutorial').set('Authorization', auth).send(body as object);
const reset = (auth: string) => api().post('/api/tutorial/reset').set('Authorization', auth);

describe('tutorial state', () => {
  it('has no tutorial on an existing account', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await me(auth);

    expect(response.status).toBe(200);
    expect(response.body.tutorial).toBeUndefined();
  });

  it('starts the tutorial once', async () => {
    const auth = bearerFor(await createUser({}));

    const first = await start(auth);
    expect(first.status).toBe(200);
    expect(first.body.tutorial).toEqual({ tour: 'active', modes: {} });

    await patch(auth, { mode: 'rain', status: 'done' });
    const second = await start(auth);
    expect(second.body.tutorial).toEqual({ tour: 'active', modes: { rain: 'done' } });
  });

  it('marks a mode done or skipped', async () => {
    const auth = bearerFor(await createUser({}));
    await start(auth);

    await patch(auth, { mode: 'practice', status: 'done' });
    const response = await patch(auth, { mode: 'daily', status: 'skipped' });

    expect(response.status).toBe(200);
    expect(response.body.tutorial.modes).toEqual({ practice: 'done', daily: 'skipped' });
    expect((await me(auth)).body.tutorial.modes).toEqual({ practice: 'done', daily: 'skipped' });
  });

  it('ends the tour', async () => {
    const auth = bearerFor(await createUser({}));
    await start(auth);

    const response = await patch(auth, { tour: 'skipped' });

    expect(response.body.tutorial).toEqual({ tour: 'skipped', modes: {} });
  });

  it('refuses a patch without a tutorial', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await patch(auth, { mode: 'rain', status: 'done' });

    expect(response.status).toBe(400);
    expect((await me(auth)).body.tutorial).toBeUndefined();
  });

  it('validates the change', async () => {
    const auth = bearerFor(await createUser({}));
    await start(auth);

    expect((await patch(auth, { mode: 'chess', status: 'done' })).status).toBe(400);
    expect((await patch(auth, { mode: 'rain' })).status).toBe(400);
    expect((await patch(auth, { tour: 'active' })).status).toBe(400);
    expect((await patch(auth, {})).status).toBe(400);
  });

  it('resets the tutorial, also for an existing account', async () => {
    const auth = bearerFor(await createUser({}));
    await start(auth);
    await patch(auth, { mode: 'rank', status: 'done' });
    await patch(auth, { tour: 'done' });

    expect((await reset(auth)).body.tutorial).toEqual({ tour: 'active', modes: {} });

    const old = bearerFor(await createUser({ email: 'old@example.com' }));
    expect((await reset(old)).body.tutorial).toEqual({ tour: 'active', modes: {} });
  });

  it('requires authentication', async () => {
    expect((await api().post('/api/tutorial/start')).status).toBe(401);
    expect((await api().patch('/api/tutorial').send({ tour: 'done' })).status).toBe(401);
    expect((await api().post('/api/tutorial/reset')).status).toBe(401);
  });
});
