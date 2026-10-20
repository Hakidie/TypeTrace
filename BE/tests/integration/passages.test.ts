import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { PassageModel } from '../../src/models/passage.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const listPassages = (authorization: string, query = '') => api().get(`/api/passages${query}`).set('Authorization', authorization);
const startSession = (authorization: string, body: Record<string, unknown>) =>
  api().post('/api/sessions').set('Authorization', authorization).send(body);

// The tests start with an empty database: load the starter passages (practice and placement ones) first.
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
});

describe('GET /api/passages', () => {
  it('needs a signed-in user and a known mode', async () => {
    expect((await api().get('/api/passages')).status).toBe(401);
    expect((await listPassages(bearerFor(await createUser({})), '?mode=rank')).status).toBe(400);
  });

  it('lists the published public practice passages by default, with title and word count only', async () => {
    const response = await listPassages(bearerFor(await createUser({})));

    const expected = await PassageModel.find({ status: 'published', visibility: 'public', isPlacement: false });
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(expected.length);
    expect(response.body.items[0]).toEqual({ _id: expect.any(String), title: expect.any(String), wordCount: expect.any(Number) });
    const titles = response.body.items.map((item: { title: string }) => item.title);
    expect(titles).toEqual([...titles].sort((a: string, b: string) => a.localeCompare(b, 'vi')));
  });

  it('lists only placement passages in placement mode', async () => {
    const response = await listPassages(bearerFor(await createUser({})), '?mode=placement');

    const ids = response.body.items.map((item: { _id: string }) => item._id);
    const found = await PassageModel.find({ _id: { $in: ids } });
    expect(ids.length).toBeGreaterThan(0);
    expect(found.every((passage) => passage.isPlacement)).toBe(true);
    expect(ids).toHaveLength(await PassageModel.countDocuments({ isPlacement: true, status: 'published', visibility: 'public' }));
  });

  it('adds the learner own passages in practice, but never drafts, archived or other private passages', async () => {
    const me = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    const base = { content: 'Một đoạn văn ngắn.', source: 'Tự viết' };
    await PassageModel.create({ ...base, title: 'Của tôi', visibility: 'private', status: 'published', owner: me._id });
    await PassageModel.create({ ...base, title: 'Của họ', visibility: 'private', status: 'published', owner: other._id });
    await PassageModel.create({ ...base, title: 'Nháp của tôi', visibility: 'private', status: 'draft', owner: me._id });
    await PassageModel.create({ ...base, title: 'Đã lưu trữ', visibility: 'public', status: 'archived' });

    const titles = (await listPassages(bearerFor(me))).body.items.map((item: { title: string }) => item.title);

    expect(titles).toContain('Của tôi');
    expect(titles).not.toContain('Của họ');
    expect(titles).not.toContain('Nháp của tôi');
    expect(titles).not.toContain('Đã lưu trữ');
    expect((await listPassages(bearerFor(other))).body.items.map((item: { title: string }) => item.title)).not.toContain('Của tôi');
  });
});

describe('POST /api/sessions with a passageId and a mode', () => {
  it('only accepts a passage that belongs to the mode', async () => {
    const auth = bearerFor(await createUser({}));
    const practice = (await PassageModel.findOne({ isPlacement: false, status: 'published' }))!;
    const placement = (await PassageModel.findOne({ isPlacement: true, status: 'published' }))!;

    expect((await startSession(auth, { mode: 'practice', passageId: String(practice._id) })).status).toBe(201);
    expect((await startSession(auth, { mode: 'placement', passageId: String(placement._id) })).status).toBe(201);
    expect((await startSession(auth, { mode: 'placement', passageId: String(practice._id) })).status).toBe(400);
    expect((await startSession(auth, { mode: 'practice', passageId: String(placement._id) })).status).toBe(400);
  });
});
