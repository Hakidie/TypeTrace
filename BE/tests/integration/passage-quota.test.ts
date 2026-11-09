import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { AppSettingModel, DEFAULT_PLANS } from '../../src/models/app-setting.model';
import { MIN_USER_PASSAGE_WORDS, PassageModel } from '../../src/models/passage.model';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { updateAppSettings } from '../../src/services/app-setting.service';
import { countCountedPassages, getLockedPassageIds, getPassageAccess } from '../../src/services/passage-lock.service';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const FREE_MAX = DEFAULT_PLANS.free.maxPassages;
const content = Array.from({ length: MIN_USER_PASSAGE_WORDS }, () => 'chữ').join(' ');

/** A passage of `owner` put straight in the database; `age` days old (a bigger age is older). */
const passageOf = (owner: { _id: unknown }, title: string, age = 0, extra: Record<string, unknown> = {}) =>
  PassageModel.create({
    title,
    content,
    source: 'Tự viết',
    visibility: 'private',
    status: 'published',
    owner: owner._id,
    createdAt: new Date(Date.now() - age * 86_400_000),
    ...extra
  });

/** `count` published private passages, the oldest first by title. */
const manyPassages = async (owner: { _id: unknown }, count: number) => {
  const made = [];
  for (let i = 0; i < count; i += 1) made.push(await passageOf(owner, `Bài ${i + 1}`, count - i));
  return made;
};

const makePremium = (user: { _id: unknown }) =>
  SubscriptionModel.create({ user: user._id, plan: 'premium', startsAt: new Date(), expiresAt: new Date(Date.now() + 30 * 86_400_000), source: 'admin', changedBy: null });

const startSession = (auth: string, body: Record<string, unknown> = {}) => api().post('/api/sessions').set('Authorization', auth).send(body);
const listPassages = (auth: string, query = '') => api().get(`/api/passages${query}`).set('Authorization', auth);
const ids = (list: { toString(): string }[]) => list.map(String).sort();

beforeEach(async () => {
  await AppSettingModel.init();
  await seedPassages(PASSAGE_LIST);
});

describe('passage quota', () => {
  it('counts draft, private, pending, rejected and public passages but not archived or placement ones', async () => {
    const me = await createUser();
    await passageOf(me, 'Nháp', 0, { status: 'draft' });
    await passageOf(me, 'Riêng tư');
    await passageOf(me, 'Chờ duyệt', 0, { status: 'pending' });
    await passageOf(me, 'Bị từ chối', 0, { status: 'rejected' });
    await passageOf(me, 'Công khai', 0, { visibility: 'public' });
    await passageOf(me, 'Lưu trữ', 0, { status: 'archived' });
    await passageOf(me, 'Placement', 0, { isPlacement: true });
    await passageOf(await createUser({ email: 'other@example.com' }), 'Của người khác');

    expect(await countCountedPassages(String(me._id))).toBe(5);
    expect(await getPassageAccess(String(me._id))).toMatchObject({ plan: 'free', maxPassages: FREE_MAX, used: 5, canUsePublicPassages: false, canCreateErrorPractice: false, expiresAt: null });
  });

  it("never counts or locks an admin's passages", async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await manyPassages(admin, FREE_MAX + 3);

    expect(await countCountedPassages(String(admin._id))).toBe(0);
    expect(await getLockedPassageIds({ ownerId: String(admin._id) })).toEqual([]);
    expect(await getLockedPassageIds()).toEqual([]);
  });

  it('keeps the newest N passages of a free learner and locks the older ones', async () => {
    const me = await createUser();
    const made = await manyPassages(me, FREE_MAX + 3);

    expect(ids(await getLockedPassageIds({ ownerId: String(me._id) }))).toEqual(ids(made.slice(0, 3).map((p) => p._id)));
    expect(ids(await getLockedPassageIds())).toEqual(ids(made.slice(0, 3).map((p) => p._id)));
  });

  it('hides a locked passage from other learners even when it is public and approved', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const [oldest] = await manyPassages(owner, FREE_MAX + 1);
    await PassageModel.updateOne({ _id: oldest._id }, { visibility: 'public', ownerName: 'Chủ bài' });
    const viewer = await createUser({ email: 'viewer@example.com' });
    await makePremium(viewer);

    const seen = await listPassages(bearerFor(viewer), '?mine=false&limit=100');

    expect(seen.body.items.map((item: { title: string }) => item.title)).not.toContain(oldest.title);
  });

  it('shows the owner a locked passage as locked and lets them delete it, even when it is public', async () => {
    const me = await createUser();
    const [oldest] = await manyPassages(me, FREE_MAX + 1);
    await PassageModel.updateOne({ _id: oldest._id }, { visibility: 'public' });
    const auth = bearerFor(me);

    const mine = await listPassages(auth, '?mine=true&limit=100');
    const item = mine.body.items.find((entry: { _id: string }) => entry._id === String(oldest._id));
    expect(item).toMatchObject({ locked: true });
    expect(mine.body.items.filter((entry: { locked?: boolean }) => entry.locked)).toHaveLength(1);

    expect((await api().delete(`/api/passages/${oldest._id}`).set('Authorization', auth)).status).toBe(204);
    expect(await PassageModel.exists({ _id: oldest._id })).toBeNull();
  });

  it('unlocks the next oldest passage when a newer one is deleted', async () => {
    const me = await createUser();
    const made = await manyPassages(me, FREE_MAX + 1);
    expect(await getLockedPassageIds({ ownerId: String(me._id) })).toHaveLength(1);

    const res = await api().delete(`/api/passages/${made[FREE_MAX]._id}`).set('Authorization', bearerFor(me));

    expect(res.status).toBe(204);
    expect(await getLockedPassageIds({ ownerId: String(me._id) })).toEqual([]);
  });

  it('unlocks everything when the learner buys premium again', async () => {
    const me = await createUser();
    await manyPassages(me, FREE_MAX + 3);
    expect(await getLockedPassageIds({ ownerId: String(me._id) })).toHaveLength(3);

    await makePremium(me);

    expect(await getLockedPassageIds({ ownerId: String(me._id) })).toEqual([]);
    expect(await getPassageAccess(String(me._id))).toMatchObject({ plan: 'premium', maxPassages: DEFAULT_PLANS.premium.maxPassages });
  });

  it('locks everything and refuses a new passage when the quota is 0', async () => {
    const me = await createUser();
    await manyPassages(me, 2);
    await updateAppSettings({ plans: { ...DEFAULT_PLANS, free: { ...DEFAULT_PLANS.free, maxPassages: 0 } } });

    expect(await getLockedPassageIds({ ownerId: String(me._id) })).toHaveLength(2);
    const added = await api().post('/api/passages').set('Authorization', bearerFor(me)).send({ title: 'Mới', source: 'Tự viết', content });
    expect(added.status).toBe(400);
    expect(added.body.message).toBe('You can have at most 0 passages');
  });

  it('refuses a new passage over the plan limit with the limit in the message', async () => {
    const me = await createUser();
    await manyPassages(me, FREE_MAX);

    const added = await api().post('/api/passages').set('Authorization', bearerFor(me)).send({ title: 'Mới', source: 'Tự viết', content });

    expect(added.status).toBe(400);
    expect(added.body.message).toBe(`You can have at most ${FREE_MAX} passages`);
  });
});

describe('passage access by plan', () => {
  it('does not let a locked passage start a session', async () => {
    const me = await createUser();
    const [oldest] = await manyPassages(me, FREE_MAX + 1);

    const res = await startSession(bearerFor(me), { passageId: String(oldest._id) });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Unknown passage');
  });

  it("answers 403 when a free learner starts a session with another learner's public passage", async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const theirs = await passageOf(owner, 'Của họ', 0, { visibility: 'public', ownerName: 'Chủ bài' });
    const free = await createUser({ email: 'free@example.com' });

    const res = await startSession(bearerFor(free), { passageId: String(theirs._id) });

    expect(res.status).toBe(403);
  });

  it('lets a free learner practice a system passage and their own passage', async () => {
    const free = await createUser();
    const system = (await PassageModel.findOne({ visibility: 'public', status: 'published', isPlacement: false, owner: { $exists: false } }))!;
    const mine = await passageOf(free, 'Của tôi');

    expect((await startSession(bearerFor(free), { passageId: String(system._id) })).status).toBe(201);
    expect((await startSession(bearerFor(free), { passageId: String(mine._id) })).status).toBe(201);
  });

  it('lets a premium learner practice the approved public passage of another learner', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const theirs = await passageOf(owner, 'Của họ', 0, { visibility: 'public', ownerName: 'Chủ bài' });
    const premium = await createUser({ email: 'premium@example.com' });
    await makePremium(premium);

    expect((await startSession(bearerFor(premium), { passageId: String(theirs._id) })).status).toBe(201);
  });

  it('picks a random passage for a free learner only among the system passages', async () => {
    await PassageModel.deleteMany({});
    const owner = await createUser({ email: 'owner@example.com' });
    await passageOf(owner, 'Của họ', 0, { visibility: 'public', ownerName: 'Chủ bài' });
    const free = await createUser({ email: 'free@example.com' });

    expect((await startSession(bearerFor(free))).status).toBe(404);

    const premium = await createUser({ email: 'premium@example.com' });
    await makePremium(premium);
    expect((await startSession(bearerFor(premium))).status).toBe(201);
  });

  it('marks the public passages of others as locked by the plan in the list of a free learner only', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    await passageOf(owner, 'Của họ', 0, { visibility: 'public', ownerName: 'Chủ bài' });
    const free = await createUser({ email: 'free@example.com' });
    const premium = await createUser({ email: 'premium@example.com' });
    await makePremium(premium);
    const find = (body: { items: { title: string; lockedByPlan?: boolean }[] }) => body.items.find((item) => item.title === 'Của họ')!;

    expect(find((await listPassages(bearerFor(free), '?limit=100')).body).lockedByPlan).toBe(true);
    expect(find((await listPassages(bearerFor(premium), '?limit=100')).body).lockedByPlan).toBeUndefined();
    const system = (await listPassages(bearerFor(free), '?limit=100')).body.items.find((item: { ownerName: string }) => item.ownerName === 'TypeTrace');
    expect(system.lockedByPlan).toBeUndefined();
  });

  it('ignores plans for the placement test', async () => {
    const free = await createUser();

    expect((await startSession(bearerFor(free), { mode: 'placement' })).status).toBe(201);
  });
});
