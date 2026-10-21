import { describe, expect, it } from 'vitest';
import { MAX_USER_THEMES, ThemeModel } from '../../src/models/theme.model';
import { UserModel } from '../../src/models/user.model';
import { seedThemes } from '../../src/services/theme-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const dark = { background: '#0b1020', text: '#e6ebff', muted: '#8f9bc9', accent: '#6d8bff' };
const light = { background: '#ffffff', text: '#111111', muted: '#777777', accent: '#555555' };

const alice = () => createUser({ email: 'alice@example.com' });
const bob = () => createUser({ email: 'bob@example.com' });

const post = (user: { _id: unknown; email: string }, body: unknown) =>
  api().post('/api/themes').set('Authorization', bearerFor(user)).send(body);

/** Creates `count` dark themes for a user, straight in the database. */
const fill = (owner: { _id: unknown }, count: number) =>
  ThemeModel.insertMany(
    Array.from({ length: count }, (_, i) => ({
      name: `Theme ${i}`,
      nameLower: `theme ${i}`,
      colors: dark,
      isDark: true,
      owner: owner._id,
      ownerName: 'Alice',
      published: false
    }))
  );

describe('GET /api/themes', () => {
  it('lists the published themes and the own ones, never another user’s', async () => {
    const user = await alice();
    const other = await bob();
    await seedThemes([{ name: 'Midnight', colors: dark }]);
    await post(user, { name: 'Mine', colors: dark });
    await post(other, { name: 'Theirs', colors: dark });

    const response = await api().get('/api/themes').set('Authorization', bearerFor(user));

    expect(response.status).toBe(200);
    expect(response.body.map((theme: { name: string }) => theme.name)).toEqual(['Midnight', 'Mine']);
    expect(response.body[0]).toMatchObject({ published: true, ownerName: 'TypeTrace', isDark: true });
    expect(response.body[1]).toMatchObject({ published: false });
    expect(response.body.every((theme: object) => !('owner' in theme) && !('nameLower' in theme))).toBe(true);
  });

  it('can list the themes of one mode', async () => {
    const user = await alice();
    await seedThemes([
      { name: 'Midnight', colors: dark },
      { name: 'Mono', colors: light }
    ]);

    const darkOnly = await api().get('/api/themes?isDark=true').set('Authorization', bearerFor(user));
    const lightOnly = await api().get('/api/themes?isDark=false').set('Authorization', bearerFor(user));

    expect(darkOnly.body.map((theme: { name: string }) => theme.name)).toEqual(['Midnight']);
    expect(lightOnly.body.map((theme: { name: string }) => theme.name)).toEqual(['Mono']);
  });

  it('requires authentication', async () => {
    expect((await api().get('/api/themes')).status).toBe(401);
  });
});

describe('POST /api/themes', () => {
  it('creates a private theme, working out its mode from the background', async () => {
    const user = await alice();

    const response = await post(user, { name: '  Night sky ', colors: { ...dark, accent: '#6D8BFF' } });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Night sky',
      isDark: true,
      published: false,
      colors: { ...dark, accent: '#6d8bff' }
    });
    expect(response.body).not.toHaveProperty('owner');
    expect(await ThemeModel.countDocuments({ owner: user._id })).toBe(1);
  });

  it('only accepts colors that fit the mode in use', async () => {
    const user = await alice();

    const tooLight = await post(user, { name: 'Bright', colors: light });
    expect(tooLight.status).toBe(400);
    expect(tooLight.body.errors[0]).toMatchObject({ field: 'colors.background' });
    expect(tooLight.body.message).toMatch(/too light for a dark theme/);

    await UserModel.updateOne({ _id: user._id }, { 'settings.mode': 'light' });
    expect((await post(user, { name: 'Bright', colors: light })).body).toMatchObject({ isDark: false });
    expect((await post(user, { name: 'Night', colors: dark })).body.message).toMatch(/too dark for a light theme/);
  });

  it('refuses a name already used by the same user, ignoring case, but not by another user', async () => {
    const user = await alice();
    const other = await bob();
    await post(user, { name: 'Night', colors: dark });

    const again = await post(user, { name: 'NIGHT', colors: dark });
    const otherUser = await post(other, { name: 'night', colors: dark });

    expect(again.status).toBe(409);
    expect(otherUser.status).toBe(201);
  });

  it(`allows at most ${MAX_USER_THEMES} themes per user`, async () => {
    const user = await alice();
    await fill(user, MAX_USER_THEMES);

    const response = await post(user, { name: 'One too many', colors: dark });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(`You can have at most ${MAX_USER_THEMES} themes`);
  });

  it('does not count published themes in the limit', async () => {
    const user = await alice();
    await fill(user, MAX_USER_THEMES - 1);
    await seedThemes([{ name: 'Midnight', colors: dark }]);

    expect((await post(user, { name: 'Last one', colors: dark })).status).toBe(201);
  });

  it('rejects a bad name or color with 400', async () => {
    const user = await alice();

    const empty = await post(user, { name: '   ', colors: dark });
    const long = await post(user, { name: 'x'.repeat(31), colors: dark });
    const badHex = await post(user, { name: 'Bad', colors: { ...dark, accent: 'blue' } });
    const missing = await post(user, { name: 'Missing', colors: { background: dark.background } });

    expect(empty.body.errors[0].field).toBe('name');
    expect(long.body.errors[0]).toMatchObject({ field: 'name', message: 'At most 30 characters' });
    expect(badHex.body.errors[0].field).toBe('colors.accent');
    expect(missing.status).toBe(400);
  });

  it('rejects colors that are hard to read, naming each one', async () => {
    const user = await alice();

    const response = await post(user, { name: 'Murky', colors: { ...dark, text: '#222a44', accent: '#10182e' } });

    expect(response.status).toBe(400);
    expect(response.body.errors.map((error: { field: string }) => error.field)).toEqual(['colors.text', 'colors.accent']);
    expect(response.body.errors[0].message).toMatch(/Text is hard to read on this background/);
    expect(await ThemeModel.countDocuments()).toBe(0);
  });
});

describe('PATCH /api/themes/:id', () => {
  const patch = (user: { _id: unknown; email: string }, id: unknown, body: unknown) =>
    api().patch(`/api/themes/${id}`).set('Authorization', bearerFor(user)).send(body);

  it('renames and recolors the own theme', async () => {
    const user = await alice();
    const { body: created } = await post(user, { name: 'Night', colors: dark });

    const response = await patch(user, created._id, { name: 'Dusk', colors: { ...dark, accent: '#ff8800' } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: 'Dusk', colors: { ...dark, accent: '#ff8800' }, isDark: true });
  });

  it('keeps the theme in its mode', async () => {
    const user = await alice();
    const { body: created } = await post(user, { name: 'Night', colors: dark });

    const response = await patch(user, created._id, { colors: light });

    expect(response.status).toBe(400);
    expect((await ThemeModel.findById(created._id))!.colors.background).toBe(dark.background);
  });

  it('refuses a name another own theme already has, but lets a theme keep its name', async () => {
    const user = await alice();
    await post(user, { name: 'Night', colors: dark });
    const { body: second } = await post(user, { name: 'Dusk', colors: dark });

    expect((await patch(user, second._id, { name: 'night' })).status).toBe(409);
    expect((await patch(user, second._id, { name: 'DUSK' })).status).toBe(200);
  });

  it('answers 404 for another user’s theme and for a published one', async () => {
    const user = await alice();
    const other = await bob();
    const { body: theirs } = await post(other, { name: 'Theirs', colors: dark });
    await seedThemes([{ name: 'Midnight', colors: dark }]);
    const published = await ThemeModel.findOne({ published: true });

    expect((await patch(user, theirs._id, { name: 'Mine now' })).status).toBe(404);
    expect((await patch(user, published!._id, { name: 'Mine now' })).status).toBe(404);
  });

  it('rejects an empty body and unreadable colors with 400', async () => {
    const user = await alice();
    const { body: created } = await post(user, { name: 'Night', colors: dark });

    expect((await patch(user, created._id, {})).status).toBe(400);
    expect((await patch(user, created._id, { colors: { ...dark, text: '#222a44' } })).status).toBe(400);
  });
});

describe('DELETE /api/themes/:id', () => {
  const remove = (user: { _id: unknown; email: string }, id: unknown) =>
    api().delete(`/api/themes/${id}`).set('Authorization', bearerFor(user));

  it('deletes the own theme and puts the fallback back in the mode that used it', async () => {
    const user = await alice();
    const { body: created } = await post(user, { name: 'Night', colors: dark });
    await api().patch('/api/themes/active').set('Authorization', bearerFor(user)).send({ darkTheme: created._id });

    const response = await remove(user, created._id);

    expect(response.status).toBe(204);
    expect(await ThemeModel.countDocuments()).toBe(0);
    expect((await UserModel.findById(user._id))!.settings.darkTheme).toBeNull();
  });

  it('answers 404 for another user’s theme and for a published one', async () => {
    const user = await alice();
    const other = await bob();
    const { body: theirs } = await post(other, { name: 'Theirs', colors: dark });
    await seedThemes([{ name: 'Midnight', colors: dark }]);
    const published = await ThemeModel.findOne({ published: true });

    expect((await remove(user, theirs._id)).status).toBe(404);
    expect((await remove(user, published!._id)).status).toBe(404);
    expect(await ThemeModel.countDocuments()).toBe(2);
  });
});

describe('/api/themes/active', () => {
  const get = (user: { _id: unknown; email: string }) => api().get('/api/themes/active').set('Authorization', bearerFor(user));
  const patch = (user: { _id: unknown; email: string }, body: unknown) =>
    api().patch('/api/themes/active').set('Authorization', bearerFor(user)).send(body);

  it('starts in dark mode with the fallback of both modes', async () => {
    const user = await alice();

    const response = await get(user);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mode: 'dark', dark: null, light: null });
  });

  it('chooses a theme for each mode, published or own, and switches the mode', async () => {
    const user = await alice();
    await seedThemes([{ name: 'Mono', colors: light }]);
    const mono = await ThemeModel.findOne({ name: 'Mono' });
    const { body: night } = await post(user, { name: 'Night', colors: dark });

    const response = await patch(user, { mode: 'light', darkTheme: night._id, lightTheme: String(mono!._id) });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      mode: 'light',
      dark: { name: 'Night', isDark: true },
      light: { name: 'Mono', isDark: false }
    });
    expect(response.body.dark).not.toHaveProperty('owner');
    expect((await get(user)).body.mode).toBe('light');
  });

  it('puts a fallback back with null and keeps what was not sent', async () => {
    const user = await alice();
    const { body: night } = await post(user, { name: 'Night', colors: dark });
    await patch(user, { darkTheme: night._id, mode: 'light' });

    const response = await patch(user, { darkTheme: null });

    expect(response.body).toEqual({ mode: 'light', dark: null, light: null });
  });

  it('only accepts a theme of the mode’s own kind', async () => {
    const user = await alice();
    await seedThemes([{ name: 'Mono', colors: light }]);
    const mono = await ThemeModel.findOne({ name: 'Mono' });

    const response = await patch(user, { darkTheme: String(mono!._id) });

    expect(response.status).toBe(404);
    expect((await get(user)).body.dark).toBeNull();
  });

  it('answers 404 for another user’s private theme', async () => {
    const user = await alice();
    const other = await bob();
    const { body: theirs } = await post(other, { name: 'Theirs', colors: dark });

    expect((await patch(user, { darkTheme: theirs._id })).status).toBe(404);
  });

  it('answers the fallback when the chosen theme no longer exists', async () => {
    const user = await alice();
    await seedThemes([{ name: 'Midnight', colors: dark }]);
    const midnight = await ThemeModel.findOne({ name: 'Midnight' });
    await patch(user, { darkTheme: String(midnight!._id) });

    await ThemeModel.deleteOne({ _id: midnight!._id });

    expect((await get(user)).body).toEqual({ mode: 'dark', dark: null, light: null });
  });

  it('keeps each user’s choice to themselves', async () => {
    const user = await alice();
    const other = await bob();
    await seedThemes([{ name: 'Midnight', colors: dark }]);
    const midnight = await ThemeModel.findOne({ name: 'Midnight' });

    await patch(user, { darkTheme: String(midnight!._id) });

    expect((await get(other)).body.dark).toBeNull();
  });

  it('rejects an empty body or a bad value with 400, and needs a sign-in', async () => {
    const user = await alice();

    expect((await patch(user, {})).status).toBe(400);
    expect((await patch(user, { mode: 'system' })).status).toBe(400);
    expect((await patch(user, { darkTheme: 'abc' })).status).toBe(400);
    expect((await api().get('/api/themes/active')).status).toBe(401);
  });
});
