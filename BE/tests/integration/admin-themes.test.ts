import { describe, expect, it } from 'vitest';
import { ThemeModel } from '../../src/models/theme.model';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const darkColors = { background: '#0b1020', text: '#e6ebff', muted: '#8f9bc9', accent: '#6d8bff' };
const lightColors = { background: '#fbf8f1', text: '#26231f', muted: '#6b655a', accent: '#1f6f78' };
const input = { name: 'Midnight', mode: 'dark', colors: darkColors };

const signInAdmin = async () => bearerFor(await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' }));

const create = (auth: string, body: object = input) => api().post('/api/admin/themes').set('Authorization', auth).send(body);

describe('admin themes access', () => {
  it('is open to admins only: learners get 403 and anonymous visitors 401', async () => {
    const learnerAuth = bearerFor(await createUser({ email: 'learner@example.com' }));
    const auth = await signInAdmin();
    const theme = (await create(auth)).body;

    expect((await api().get('/api/admin/themes').set('Authorization', learnerAuth)).status).toBe(403);
    expect((await create(learnerAuth)).status).toBe(403);
    expect((await api().patch(`/api/admin/themes/${theme._id}`).set('Authorization', learnerAuth).send({ name: 'x' })).status).toBe(403);
    expect((await api().delete(`/api/admin/themes/${theme._id}`).set('Authorization', learnerAuth)).status).toBe(403);
    expect((await api().get('/api/admin/themes')).status).toBe(401);
    expect((await api().get('/api/admin/themes').set('Authorization', auth)).status).toBe(200);
  });
});

describe('POST /api/admin/themes', () => {
  it('creates a published theme shown as TypeTrace, without owner, of the chosen mode', async () => {
    const auth = await signInAdmin();

    const dark = await create(auth);
    const light = await create(auth, { name: 'Paper', mode: 'light', colors: lightColors });

    expect(dark.status).toBe(201);
    expect(dark.body).toMatchObject({ name: 'Midnight', colors: darkColors, isDark: true, published: true, ownerName: 'TypeTrace' });
    expect(dark.body).not.toHaveProperty('owner');
    expect(light.body).toMatchObject({ isDark: false, published: true });
    expect((await ThemeModel.findById(dark.body._id))!.owner).toBeUndefined();
  });

  it('refuses a background that does not fit the mode', async () => {
    const auth = await signInAdmin();

    const response = await create(auth, { ...input, mode: 'light' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/too dark for a light theme/);
    expect(await ThemeModel.countDocuments()).toBe(0);
  });

  it('refuses colors that are hard to read, a bad name and a name used by another TypeTrace theme', async () => {
    const auth = await signInAdmin();

    const murky = await create(auth, { ...input, colors: { ...darkColors, text: '#222a44' } });
    expect(murky.status).toBe(400);
    expect((await create(auth, { ...input, name: '  ' })).status).toBe(400);
    expect((await create(auth, { ...input, mode: 'blue' })).status).toBe(400);

    expect((await create(auth)).status).toBe(201);
    expect((await create(auth, { ...input, name: 'MIDNIGHT' })).status).toBe(409);
  });

  it('allows a name that a learner uses for a private theme', async () => {
    const learner = await createUser({ email: 'learner@example.com' });
    await ThemeModel.create({ name: 'Midnight', colors: darkColors, isDark: true, owner: learner._id, ownerName: 'Lan', published: false });
    const auth = await signInAdmin();

    expect((await create(auth)).status).toBe(201);
  });
});

describe('GET /api/admin/themes', () => {
  const seed = async () => {
    const auth = await signInAdmin();
    await create(auth, { ...input, name: 'Midnight' });
    await create(auth, { ...input, name: 'forest' });
    await create(auth, { name: 'Paper', mode: 'light', colors: lightColors });
    return auth;
  };

  it('lists only TypeTrace themes, never a learner private theme, with pagination', async () => {
    const learner = await createUser({ email: 'learner@example.com' });
    await ThemeModel.create({ name: 'Private', colors: darkColors, isDark: true, owner: learner._id, ownerName: 'Lan', published: false });
    const auth = await seed();

    const response = await api().get('/api/admin/themes?limit=2').set('Authorization', auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(response.body.items).toHaveLength(2);
    expect(JSON.stringify(response.body)).not.toContain('Private');
  });

  it('searches by name, filters by mode and sorts by name ignoring case', async () => {
    const auth = await seed();
    const names = async (query: string) =>
      (await api().get(`/api/admin/themes?${query}`).set('Authorization', auth)).body.items.map((theme: { name: string }) => theme.name);

    expect(await names('q=mid')).toEqual(['Midnight']);
    expect(await names('isDark=false')).toEqual(['Paper']);
    expect(await names('isDark=true&sort=name')).toEqual(['forest', 'Midnight']);
    expect(await names('sort=-name')).toEqual(['Paper', 'Midnight', 'forest']);
    expect(await names('q=.*')).toEqual([]);
  });

  it('refuses a sort field that is not allowed', async () => {
    const auth = await signInAdmin();

    expect((await api().get('/api/admin/themes?sort=owner').set('Authorization', auth)).status).toBe(400);
  });
});

describe('PATCH /api/admin/themes/:id', () => {
  it('renames and recolors a theme of the same mode', async () => {
    const auth = await signInAdmin();
    const theme = (await create(auth)).body;
    const colors = { ...darkColors, accent: '#ff8844' };

    const response = await api().patch(`/api/admin/themes/${theme._id}`).set('Authorization', auth).send({ name: 'Night', colors });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: 'Night', colors, isDark: true });
  });

  it('cannot move a theme to the other mode, take another theme name or edit a learner theme', async () => {
    const auth = await signInAdmin();
    const theme = (await create(auth)).body;
    await create(auth, { name: 'Paper', mode: 'light', colors: lightColors });
    const learner = await createUser({ email: 'learner@example.com' });
    const mine = await ThemeModel.create({ name: 'Mine', colors: darkColors, isDark: true, owner: learner._id, ownerName: 'Lan', published: false });
    const patch = (id: string, body: object) => api().patch(`/api/admin/themes/${id}`).set('Authorization', auth).send(body);

    expect((await patch(theme._id, { colors: lightColors })).status).toBe(400);
    expect((await patch(theme._id, { name: 'paper' })).status).toBe(409);
    expect((await patch(theme._id, { name: 'midnight' })).status).toBe(200);
    expect((await patch(String(mine._id), { name: 'Hijacked' })).status).toBe(404);
    expect((await patch(theme._id, {})).status).toBe(400);
  });
});

describe('DELETE /api/admin/themes/:id', () => {
  it('deletes the theme and puts the fallback back for everyone who had chosen it', async () => {
    const auth = await signInAdmin();
    const theme = (await create(auth)).body;
    const learner = await createUser({ email: 'learner@example.com' });
    await UserModel.updateOne({ _id: learner._id }, { 'settings.darkTheme': theme._id });

    const response = await api().delete(`/api/admin/themes/${theme._id}`).set('Authorization', auth);

    expect(response.status).toBe(204);
    expect(await ThemeModel.countDocuments()).toBe(0);
    expect((await UserModel.findById(learner._id))!.settings.darkTheme).toBeNull();
    expect((await api().get('/api/themes/active').set('Authorization', bearerFor(learner))).body.dark).toBeNull();
  });

  it('answers 404 for an unknown theme and for a learner private theme', async () => {
    const auth = await signInAdmin();
    const learner = await createUser({ email: 'learner@example.com' });
    const mine = await ThemeModel.create({ name: 'Mine', colors: darkColors, isDark: true, owner: learner._id, ownerName: 'Lan', published: false });

    expect((await api().delete(`/api/admin/themes/${mine._id}`).set('Authorization', auth)).status).toBe(404);
    expect((await api().delete('/api/admin/themes/64b7f0a5c2a5f1a1a1a1a1a1').set('Authorization', auth)).status).toBe(404);
    expect(await ThemeModel.countDocuments()).toBe(1);
  });
});
