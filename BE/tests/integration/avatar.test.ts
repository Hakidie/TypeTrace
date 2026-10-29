import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../../src/data/avatar-catalog';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const getCatalog = (auth: string) => api().get('/api/avatar/catalog').set('Authorization', auth);
const saveLook = (auth: string, look: object) => api().put('/api/avatar').set('Authorization', auth).send(look);
const itemOf = (body: { slots: Record<string, { id: string }[]> }, slot: string, id: string) => body.slots[slot].find((item) => item.id === id);

describe('avatar API (ranked duel, phase 2)', () => {
  it('needs a signed-in user', async () => {
    expect((await api().get('/api/avatar/catalog')).status).toBe(401);
    expect((await api().put('/api/avatar').send(DEFAULT_AVATAR)).status).toBe(401);
  });

  it('lists every slot with what is free, for sale, a reward, and owned', async () => {
    const response = await getCatalog(bearerFor(await createUser({})));

    expect(response.status).toBe(200);
    expect(response.body.avatar).toMatchObject(DEFAULT_AVATAR);
    expect(response.body.coins).toBe(0);
    expect(Object.keys(response.body.slots)).toHaveLength(10);
    expect(itemOf(response.body, 'hair', 'short-brown')).toEqual({ id: 'short-brown', unlock: { kind: 'free' }, owned: true });
    expect(itemOf(response.body, 'hair', 'buns-pink')).toEqual({ id: 'buns-pink', unlock: { kind: 'shop', price: 100 }, owned: false });
    expect(itemOf(response.body, 'headwear', 'halo')).toEqual({ id: 'halo', unlock: { kind: 'tier', tier: 'legend' }, owned: false });
  });

  it('counts an owned item as owned', async () => {
    const user = await createUser({});
    await UserModel.updateOne({ _id: user._id }, { ownedItems: ['hair:buns-pink'] });

    expect(itemOf((await getCatalog(bearerFor(user))).body, 'hair', 'buns-pink')).toMatchObject({ owned: true });
  });

  it('works for an account saved before the avatar fields', async () => {
    const user = await createUser({});
    await UserModel.collection.updateOne({ _id: user._id }, { $unset: { avatar: '', coins: '', ownedItems: '' } });

    const response = await getCatalog(bearerFor(user));
    expect(response.status).toBe(200);
    expect(response.body.avatar).toMatchObject(DEFAULT_AVATAR);
    expect(response.body.coins).toBe(0);
  });

  it('saves a look made of free items', async () => {
    const user = await createUser({});
    const look = { ...DEFAULT_AVATAR, skin: 'umber', face: 'cute', hair: 'long-pink', top: 'mint' };

    expect((await saveLook(bearerFor(user), look)).status).toBe(200);
    expect((await api().get('/api/auth/me').set('Authorization', bearerFor(user))).body.avatar).toMatchObject(look);
  });

  it('saves owned items and clears optional slots', async () => {
    const user = await createUser({});
    await UserModel.updateOne({ _id: user._id }, { ownedItems: ['headwear:crown'] });
    const auth = bearerFor(user);

    const crowned = await saveLook(auth, { ...DEFAULT_AVATAR, headwear: 'crown' });
    expect(crowned.status).toBe(200);
    expect(crowned.body.avatar.headwear).toBe('crown');
    const bare = await saveLook(auth, { ...DEFAULT_AVATAR, headwear: null });
    expect(bare.status).toBe(200);
    expect(bare.body.avatar.headwear).toBeNull();
  });

  it('refuses unknown, misplaced or locked items and keeps the look', async () => {
    const user = await createUser({});
    const auth = bearerFor(user);
    await saveLook(auth, { ...DEFAULT_AVATAR, hair: 'long-pink' });

    const unknown = await saveLook(auth, { ...DEFAULT_AVATAR, hair: 'nope' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toBe('Unknown item: hair nope');
    expect((await saveLook(auth, { ...DEFAULT_AVATAR, hair: 'crown' })).body.message).toBe('Unknown item: hair crown');
    const locked = await saveLook(auth, { ...DEFAULT_AVATAR, hair: 'buns-pink' });
    expect(locked.status).toBe(400);
    expect(locked.body.message).toBe('Item not owned: hair buns-pink');
    const { skin: _skin, ...withoutSkin } = DEFAULT_AVATAR;
    expect((await saveLook(auth, withoutSkin)).status).toBe(400);

    expect((await UserModel.findById(user._id))!.avatar.hair).toBe('long-pink');
  });

  it('never sends coins or owned items in the user list of another learner', async () => {
    // No learner endpoint returns other users; the passage list only shows an owner name.
    const owner = await createUser({ email: 'owner@example.com', displayName: 'Lan' });
    await UserModel.updateOne({ _id: owner._id }, { coins: 50, ownedItems: ['hair:buns-pink'] });
    const response = await api().get('/api/passages').set('Authorization', bearerFor(await createUser({})));

    expect(JSON.stringify(response.body)).not.toMatch(/coins|ownedItems/);
  });
});
