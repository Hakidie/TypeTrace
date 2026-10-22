import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { MAX_USER_PASSAGES, MIN_USER_PASSAGE_WORDS, PassageModel, USER_PASSAGE_SOURCE } from '../../src/models/passage.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { learnerPassageFilter } from '../../src/services/passage.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const listPassages = (authorization: string, query = '') => api().get(`/api/passages${query}`).set('Authorization', authorization);
const addPassage = (authorization: string, body: Record<string, unknown>) =>
  api().post('/api/passages').set('Authorization', authorization).send(body);
const deletePassage = (authorization: string, id: string) =>
  api().delete(`/api/passages/${id}`).set('Authorization', authorization);
const startSession = (authorization: string, body: Record<string, unknown>) =>
  api().post('/api/sessions').set('Authorization', authorization).send(body);

const titlesOf = (response: { body: { items: { title: string }[] } }) => response.body.items.map((item) => item.title);

/** A text of `count` words, all the same. */
const wordsOf = (count: number) => Array.from({ length: count }, () => 'chữ').join(' ');
const longEnough = wordsOf(MIN_USER_PASSAGE_WORDS);

/** A learner's own passage, put straight in the database (no limit). */
const ownPassage = (owner: { _id: unknown }, title: string, extra: Record<string, unknown> = {}) =>
  PassageModel.create({ title, content: longEnough, source: 'Tự viết', visibility: 'private', status: 'published', owner: owner._id, ...extra });

// The tests start with an empty database: load the starter passages (practice and placement ones) first.
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
});

describe('GET /api/passages', () => {
  it('needs a signed-in user and valid filters', async () => {
    expect((await api().get('/api/passages')).status).toBe(401);

    const auth = bearerFor(await createUser({}));
    for (const query of ['?mode=rank', '?visibility=secret', '?sort=owner', '?sort=content', '?limit=101', '?page=0']) {
      expect((await listPassages(auth, query)).status).toBe(400);
    }
  });

  it('lists the published public practice passages by default, by title, without the text or the owner', async () => {
    const response = await listPassages(bearerFor(await createUser({})));

    const expected = await PassageModel.find({ status: 'published', visibility: 'public', isPlacement: false });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 1, limit: 20, total: expected.length, totalPages: 1 });
    expect(response.body.items).toHaveLength(expected.length);
    expect(response.body.items[0]).toEqual({
      _id: expect.any(String),
      title: expect.any(String),
      wordCount: expect.any(Number),
      ownerName: 'TypeTrace',
      visibility: 'public',
      status: 'published',
      isOwn: false,
      createdAt: expect.any(String)
    });
    const titles = titlesOf(response);
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

    const titles = titlesOf(await listPassages(bearerFor(me)));

    expect(titles).toContain('Của tôi');
    expect(titles).not.toContain('Của họ');
    expect(titles).not.toContain('Nháp của tôi');
    expect(titles).not.toContain('Đã lưu trữ');
    expect(titlesOf(await listPassages(bearerFor(other)))).not.toContain('Của tôi');
  });

  it('pages through the list without repeating or skipping a passage', async () => {
    const me = await createUser({});
    for (let i = 1; i <= 3; i += 1) await ownPassage(me, `Bài ${i}`);
    const auth = bearerFor(me);
    const total = await PassageModel.countDocuments({ status: 'published', isPlacement: false });
    const totalPages = Math.ceil(total / 3);

    const pages = await Promise.all(Array.from({ length: totalPages }, (_, index) => listPassages(auth, `?limit=3&page=${index + 1}`)));

    expect(pages[0].body).toMatchObject({ page: 1, limit: 3, total, totalPages });
    const ids = pages.flatMap((page) => page.body.items.map((item: { _id: string }) => item._id));
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
  });

  it('searches the title, ignoring case and taking the text literally', async () => {
    const me = await createUser({});
    await ownPassage(me, 'Mùa thu (1)');
    const auth = bearerFor(me);

    expect(titlesOf(await listPassages(auth, '?q=THU'))).toEqual(['Hà Nội vào thu', 'Mùa thu (1)']);
    expect(titlesOf(await listPassages(auth, `?q=${encodeURIComponent('(1)')}`))).toEqual(['Mùa thu (1)']);
    expect((await listPassages(auth, `?q=${encodeURIComponent('.*')}`)).body.total).toBe(0);
    // Some Vietnamese keyboards send decomposed letters: they still find the composed title.
    expect(titlesOf(await listPassages(auth, `?q=${encodeURIComponent('Mùa'.normalize('NFD'))}`))).toEqual(['Mùa thu (1)']);
  });

  it('finds a title typed without its accents, while the accents that are typed must match', async () => {
    const me = await createUser({});
    await ownPassage(me, 'Đường về nhà');
    const auth = bearerFor(me);
    const search = async (q: string) => titlesOf(await listPassages(auth, `?q=${encodeURIComponent(q)}`));

    expect(await search('ha noi')).toEqual(['Hà Nội vào thu']);
    expect(await search('HA NOI')).toEqual(['Hà Nội vào thu']);
    expect(await search('duong')).toEqual(['Đường về nhà']);
    expect(await search('ĐƯỜNG')).toEqual(['Đường về nhà']);
    expect(await search('nhà')).toEqual(['Đường về nhà']);
    expect(await search('nhạ')).toEqual([]);
  });

  it('reads only the passages the learner may see, not the private passages of every other learner', async () => {
    const me = await createUser({});
    for (let i = 1; i <= 3; i += 1) {
      const other = await createUser({ email: `other${i}@example.com` });
      for (let j = 1; j <= 5; j += 1) await ownPassage(other, `Của họ ${i}.${j}`);
    }
    await PassageModel.init();
    const filter = learnerPassageFilter(String(me._id), 'practice');

    // The query of `listPassages`: titles in Vietnamese order need an index with the same collation.
    const explained = await PassageModel.find({ $and: [filter] }).collation({ locale: 'vi' }).sort('title _id').limit(20).explain('executionStats');
    const [plan] = [explained].flat() as { executionStats: { totalDocsExamined: number } }[];

    expect(plan.executionStats.totalDocsExamined).toBeLessThanOrEqual(await PassageModel.countDocuments(filter));
  });

  it('keeps only the own passages with visibility=private, and only TypeTrace ones with public', async () => {
    const me = await createUser({});
    await ownPassage(me, 'Của tôi');
    await ownPassage(await createUser({ email: 'other@example.com' }), 'Của họ');
    // Not offered even with visibility=private: the placement test only uses public passages.
    await ownPassage(me, 'Kiểm tra riêng', { isPlacement: true });
    const auth = bearerFor(me);

    const mine = await listPassages(auth, '?visibility=private');
    expect(titlesOf(mine)).toEqual(['Của tôi']);
    expect(mine.body.items[0].visibility).toBe('private');

    const typeTrace = titlesOf(await listPassages(auth, '?visibility=public'));
    expect(typeTrace).toHaveLength(await PassageModel.countDocuments({ status: 'published', visibility: 'public', isPlacement: false }));
    expect(typeTrace).not.toContain('Của tôi');

    expect((await listPassages(auth, '?mode=placement&visibility=private')).body.items).toEqual([]);
  });

  it('sorts by word count or by date when asked', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);

    const counts = (await listPassages(auth, '?sort=-wordCount')).body.items.map((item: { wordCount: number }) => item.wordCount);
    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));

    await ownPassage(me, 'Mới nhất');
    expect(titlesOf(await listPassages(auth, '?sort=-createdAt'))[0]).toBe('Mới nhất');
  });
});

describe('POST /api/passages', () => {
  it('adds a private, published passage that the learner can type at once', async () => {
    const me = await createUser({ displayName: 'Lan' });
    const auth = bearerFor(me);
    const content = `Hôm nay trời đẹp. ${longEnough}`;

    const response = await addPassage(auth, { title: 'Của Lan', content });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      _id: expect.any(String),
      title: 'Của Lan',
      wordCount: MIN_USER_PASSAGE_WORDS + 4,
      ownerName: 'Lan',
      visibility: 'private',
      status: 'published',
      isOwn: true,
      createdAt: expect.any(String)
    });
    const saved = (await PassageModel.findById(response.body._id))!.toObject();
    expect(saved).toMatchObject({ content, status: 'published', isPlacement: false, source: USER_PASSAGE_SOURCE });
    expect(String(saved.owner)).toBe(String(me._id));

    expect(titlesOf(await listPassages(auth, '?visibility=private'))).toEqual(['Của Lan']);
    expect(titlesOf(await listPassages(bearerFor(await createUser({ email: 'other@example.com' }))))).not.toContain('Của Lan');
    const session = await startSession(auth, { passageId: response.body._id });
    expect(session.status).toBe(201);
    expect(session.body.targetWords).toEqual(content.split(' '));
  });

  it('cleans the text first: composed letters, no HTML tags or hidden characters, keyboard punctuation, single spaces', async () => {
    const auth = bearerFor(await createUser({}));
    const decomposed = 'Tiếng Việt'.normalize('NFD');
    const content = `<p>${decomposed}</p>\n\n“Xin chào” — bạn​ ơi… <b>đẹp</b> quá\t ${longEnough}`;

    const response = await addPassage(auth, { title: '  <i>Bài</i>\nmới  ', content });

    expect(response.status).toBe(201);
    const saved = (await PassageModel.findById(response.body._id))!;
    expect(saved.title).toBe('Bài mới');
    expect(saved.content).toBe(`Tiếng Việt "Xin chào" - bạn ơi... đẹp quá ${longEnough}`);
  });

  it('makes the title from the first words when there is none', async () => {
    const auth = bearerFor(await createUser({}));
    const content = `Một hai ba bốn năm sáu bảy tám chín mười mười một ${longEnough}`;

    for (const body of [{ content }, { title: '', content }, { title: ' \n ', content }]) {
      const response = await addPassage(auth, body);
      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Một hai ba bốn năm sáu bảy tám chín mười…');
    }
  });

  it('rejects a text that is too short or too long once cleaned, a missing one and a long title', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);

    const tooShort = await addPassage(auth, { content: wordsOf(MIN_USER_PASSAGE_WORDS - 1) });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.errors).toEqual([{ field: 'content', message: `At least ${MIN_USER_PASSAGE_WORDS} words` }]);

    // Tags and hidden characters are not words.
    expect((await addPassage(auth, { content: `<p>​</p>${'<br>'.repeat(30)}` })).status).toBe(400);
    expect((await addPassage(auth, { content: `${longEnough} ${'a'.repeat(5000)}` })).status).toBe(400);
    expect((await addPassage(auth, { title: 'a'.repeat(121), content: longEnough })).status).toBe(400);
    expect((await addPassage(auth, {})).status).toBe(400);
    expect((await addPassage(auth, { content: 42 })).status).toBe(400);
    expect(await PassageModel.countDocuments({ owner: me._id })).toBe(0);
  });

  it('ignores the fields a learner may not set and shows the email as the author without a display name', async () => {
    const me = await createUser({});
    const other = await createUser({ email: 'other@example.com' });

    const response = await addPassage(bearerFor(me), {
      content: longEnough,
      visibility: 'public',
      status: 'draft',
      isPlacement: true,
      source: 'Wikipedia',
      owner: String(other._id),
      ownerName: 'TypeTrace'
    });

    expect(response.status).toBe(201);
    const saved = (await PassageModel.findById(response.body._id))!.toObject();
    expect(saved).toMatchObject({ visibility: 'private', status: 'published', isPlacement: false, source: USER_PASSAGE_SOURCE, ownerName: me.email });
    expect(String(saved.owner)).toBe(String(me._id));
  });

  it(`allows at most ${MAX_USER_PASSAGES} own passages per learner`, async () => {
    const me = await createUser({});
    const auth = bearerFor(me);
    for (let i = 1; i < MAX_USER_PASSAGES; i += 1) await ownPassage(me, `Bài ${i}`);
    // Public passages, other people's passages and an own passage an admin archived do not count.
    await ownPassage(me, 'Công khai', { visibility: 'public' });
    await ownPassage(await createUser({ email: 'other@example.com' }), 'Của họ');
    await ownPassage(me, 'Đã lưu trữ', { status: 'archived' });

    expect((await addPassage(auth, { content: longEnough })).status).toBe(201);
    const full = await addPassage(auth, { content: longEnough });
    expect(full.status).toBe(400);
    expect(full.body.message).toBe(`You can have at most ${MAX_USER_PASSAGES} passages`);

    // Deleting one makes room again.
    const one = (await PassageModel.findOne({ owner: me._id, visibility: 'private', status: 'published' }))!;
    expect((await deletePassage(auth, String(one._id))).status).toBe(204);
    expect((await addPassage(auth, { content: longEnough })).status).toBe(201);
  });

  it('keeps the limit when several passages are sent at the same time', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);
    for (let i = 1; i < MAX_USER_PASSAGES; i += 1) await ownPassage(me, `Bài ${i}`);

    const responses = await Promise.all(Array.from({ length: 5 }, () => addPassage(auth, { content: longEnough })));

    // One place is left: exactly one request takes it, the others answer 400.
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400, 400, 400, 400]);
    expect(await PassageModel.countDocuments({ owner: me._id })).toBe(MAX_USER_PASSAGES);
  });

  it('needs a signed-in user', async () => {
    expect((await api().post('/api/passages').send({ content: longEnough })).status).toBe(401);
  });
});

describe('DELETE /api/passages/:id', () => {
  it('deletes the own passage for good, while the typing sessions on it keep their words', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: passage } = await addPassage(auth, { title: 'Tạm', content: longEnough });
    const { body: session } = await startSession(auth, { passageId: passage._id });

    expect((await deletePassage(auth, passage._id)).status).toBe(204);

    expect(await PassageModel.exists({ _id: passage._id })).toBeNull();
    expect(titlesOf(await listPassages(auth, '?visibility=private'))).toEqual([]);
    const kept = await api().get(`/api/sessions/${session._id}`).set('Authorization', auth);
    expect(kept.body).toMatchObject({ passageId: passage._id, passageTitle: 'Tạm', targetWords: longEnough.split(' ') });
    expect((await startSession(auth, { passageId: passage._id })).status).toBe(400);
    expect((await deletePassage(auth, passage._id)).status).toBe(404);
  });

  it('answers 404 for another user’s passage and for a public one, even to an admin', async () => {
    const theirs = await ownPassage(await createUser({ email: 'other@example.com' }), 'Của họ');
    const publicOne = (await PassageModel.findOne({ visibility: 'public' }))!;

    for (const user of [await createUser({}), await createUser({ email: 'admin@example.com', role: 'admin' })]) {
      expect((await deletePassage(bearerFor(user), String(theirs._id))).status).toBe(404);
      expect((await deletePassage(bearerFor(user), String(publicOne._id))).status).toBe(404);
    }
    expect(await PassageModel.countDocuments({ _id: { $in: [theirs._id, publicOne._id] } })).toBe(2);
  });

  it('rejects a bad id and needs a signed-in user', async () => {
    const passage = (await PassageModel.findOne({ visibility: 'public' }))!;

    expect((await deletePassage(bearerFor(await createUser({})), 'not-an-id')).status).toBe(400);
    expect((await api().delete(`/api/passages/${passage._id}`)).status).toBe(401);
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
