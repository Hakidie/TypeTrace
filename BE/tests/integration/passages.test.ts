import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { MAX_USER_PASSAGES, MAX_PASSAGE_WORDS, MIN_USER_PASSAGE_WORDS, PassageModel } from '../../src/models/passage.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { learnerPassageFilter } from '../../src/services/passage.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const listPassages = (authorization: string, query = '') => api().get(`/api/passages${query}`).set('Authorization', authorization);
const addPassage = (authorization: string, body: Record<string, unknown>) =>
  api().post('/api/passages').set('Authorization', authorization).send(body);
const deletePassage = (authorization: string, id: string) =>
  api().delete(`/api/passages/${id}`).set('Authorization', authorization);
const getPassage = (authorization: string, id: string) => api().get(`/api/passages/${id}`).set('Authorization', authorization);
const editPassage = (authorization: string, id: string, body: Record<string, unknown>) =>
  api().patch(`/api/passages/${id}`).set('Authorization', authorization).send(body);
const startSession = (authorization: string, body: Record<string, unknown>) =>
  api().post('/api/sessions').set('Authorization', authorization).send(body);

const titlesOf = (response: { body: { items: { title: string }[] } }) => response.body.items.map((item) => item.title);

/** A text of `count` words, all the same. */
const wordsOf = (count: number) => Array.from({ length: count }, () => 'chữ').join(' ');
const longEnough = wordsOf(MIN_USER_PASSAGE_WORDS);

/** The body of a valid new passage (title and text are required, the source is not); `changes` replaces some fields. */
const newPassage = (changes: Record<string, unknown> = {}) => ({ title: 'Bài của tôi', source: 'Tự viết', content: longEnough, ...changes });

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
      source: expect.any(String),
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

  it('keeps only the learner own passages with mine=true, private or approved, and only the others with mine=false', async () => {
    const me = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    await ownPassage(me, 'Riêng của tôi');
    await ownPassage(me, 'Đang chờ duyệt', { status: 'pending' });
    await ownPassage(me, 'Đã được duyệt', { visibility: 'public' });
    await ownPassage(me, 'Bị lưu trữ', { status: 'archived' });
    await ownPassage(other, 'Của người khác', { visibility: 'public' });
    const auth = bearerFor(me);

    const mine = await listPassages(auth, '?mine=true');
    expect(mine.status).toBe(200);
    expect(titlesOf(mine)).toHaveLength(3);
    expect(titlesOf(mine)).toEqual(expect.arrayContaining(['Riêng của tôi', 'Đang chờ duyệt', 'Đã được duyệt']));
    expect(mine.body.items.every((item: { isOwn: boolean }) => item.isOwn)).toBe(true);
    expect(titlesOf(await listPassages(auth, '?mine=true&visibility=public'))).toEqual(['Đã được duyệt']);

    const others = await listPassages(auth, '?mine=false');
    expect(titlesOf(others)).toContain('Của người khác');
    expect(others.body.items.some((item: { isOwn: boolean }) => item.isOwn)).toBe(false);
    expect(others.body.total).toBe(await PassageModel.countDocuments({ status: 'published', visibility: 'public', isPlacement: false, owner: { $ne: me._id } }));
    expect((await listPassages(auth, '?mine=yes')).status).toBe(400);

    // The cards of the Passages page show the text, but only of the learner's own passages.
    expect(mine.body.items.every((item: { content?: string }) => item.content === longEnough)).toBe(true);
    expect(others.body.items.some((item: { content?: string }) => 'content' in item)).toBe(false);
    expect((await listPassages(auth, '')).body.items.some((item: { content?: string }) => 'content' in item)).toBe(false);
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

    const response = await addPassage(auth, { title: 'Của Lan', source: 'Nhật ký của Lan', content });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      _id: expect.any(String),
      title: 'Của Lan',
      source: 'Nhật ký của Lan',
      wordCount: MIN_USER_PASSAGE_WORDS + 4,
      ownerName: 'Lan',
      visibility: 'private',
      status: 'published',
      isOwn: true,
      createdAt: expect.any(String)
    });
    const saved = (await PassageModel.findById(response.body._id))!.toObject();
    expect(saved).toMatchObject({ content, status: 'published', isPlacement: false, source: 'Nhật ký của Lan' });
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

    const response = await addPassage(auth, { title: '  <i>Bài</i>\nmới  ', source: ' Sách <b>Tiếng Việt</b>\t lớp 5 ', content });

    expect(response.status).toBe(201);
    const saved = (await PassageModel.findById(response.body._id))!;
    expect(saved.title).toBe('Bài mới');
    expect(saved.source).toBe('Sách Tiếng Việt lớp 5');
    expect(saved.content).toBe(`Tiếng Việt "Xin chào" - bạn ơi... đẹp quá ${longEnough}`);
  });

  it('saves a passage without a source with the name of its author, never the email', async () => {
    const named = await createUser({ email: 'lan@example.com', displayName: 'Lan' });
    const anonymous = await createUser({ email: 'an@example.com' });
    for (const blank of [undefined, '', ' \n ', '<b></b>​']) {
      const input = { title: 'Không nguồn', content: longEnough, ...(blank === undefined ? {} : { source: blank }) };
      expect((await addPassage(bearerFor(named), input)).body.source).toBe('Lan');
    }
    const response = await addPassage(bearerFor(anonymous), { title: 'Không nguồn', content: longEnough });
    expect(response.status).toBe(201);
    expect(response.body.source).toBe('Anonymous learner');
  });

  it('requires a title, also once cleaned', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);

    const missing = await addPassage(auth, { content: longEnough });
    expect(missing.status).toBe(400);
    expect(missing.body.errors).toEqual([expect.objectContaining({ field: 'title' })]);
    // Blank, or only tags and hidden characters: nothing is left once cleaned.
    for (const blank of ['', ' \n ', '<b></b>​']) {
      const noTitle = await addPassage(auth, newPassage({ title: blank }));
      expect(noTitle.status).toBe(400);
      expect(noTitle.body.errors).toEqual([{ field: 'title', message: 'Title is required' }]);
    }
    expect((await addPassage(auth, newPassage({ source: 'a'.repeat(301) }))).status).toBe(400);
    expect(await PassageModel.countDocuments({ owner: me._id })).toBe(0);
  });

  it('rejects a text that is too short or too long once cleaned, a missing one and a long title', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);

    const tooShort = await addPassage(auth, newPassage({ content: wordsOf(MIN_USER_PASSAGE_WORDS - 1) }));
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.errors).toEqual([{ field: 'content', message: `At least ${MIN_USER_PASSAGE_WORDS} words` }]);

    const tooLong = await addPassage(auth, newPassage({ content: wordsOf(MAX_PASSAGE_WORDS + 1) }));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.errors).toEqual([{ field: 'content', message: `At most ${MAX_PASSAGE_WORDS} words` }]);

    // Tags and hidden characters are not words.
    expect((await addPassage(auth, { ...newPassage(), content: `<p>​</p>${'<br>'.repeat(30)}` })).status).toBe(400);
    expect((await addPassage(auth, newPassage({ content: `${longEnough} ${'a'.repeat(5000)}` }))).status).toBe(400);
    expect((await addPassage(auth, newPassage({ title: 'a'.repeat(121) }))).status).toBe(400);
    expect((await addPassage(auth, {})).status).toBe(400);
    expect((await addPassage(auth, newPassage({ content: 42 }))).status).toBe(400);
    expect(await PassageModel.countDocuments({ owner: me._id })).toBe(0);
  });

  it('keeps the source sent, ignores the fields a learner may not set and shows the email as the author without a display name', async () => {
    const me = await createUser({});
    const other = await createUser({ email: 'other@example.com' });

    const response = await addPassage(bearerFor(me), {
      title: 'Bài của tôi',
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
    expect(saved).toMatchObject({ visibility: 'private', status: 'published', isPlacement: false, source: 'Wikipedia', ownerName: me.email });
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

    expect((await addPassage(auth, newPassage())).status).toBe(201);
    const full = await addPassage(auth, newPassage());
    expect(full.status).toBe(400);
    expect(full.body.message).toBe(`You can have at most ${MAX_USER_PASSAGES} passages`);

    // Deleting one makes room again.
    const one = (await PassageModel.findOne({ owner: me._id, visibility: 'private', status: 'published' }))!;
    expect((await deletePassage(auth, String(one._id))).status).toBe(204);
    expect((await addPassage(auth, newPassage())).status).toBe(201);
  });

  it('keeps the limit when several passages are sent at the same time', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);
    for (let i = 1; i < MAX_USER_PASSAGES; i += 1) await ownPassage(me, `Bài ${i}`);

    const responses = await Promise.all(Array.from({ length: 5 }, () => addPassage(auth, newPassage())));

    // One place is left: exactly one request takes it, the others answer 400.
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400, 400, 400, 400]);
    expect(await PassageModel.countDocuments({ owner: me._id })).toBe(MAX_USER_PASSAGES);
  });

  it('needs a signed-in user', async () => {
    expect((await api().post('/api/passages').send(newPassage())).status).toBe(401);
  });
});

describe('GET /api/passages/:id', () => {
  it('reads an own passage with its text, never the owner, and answers 404 for any other passage', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);
    const { body: created } = await addPassage(auth, newPassage());
    const typeTrace = (await PassageModel.findOne({ visibility: 'public' }))!;
    const archived = await ownPassage(me, 'Bị lưu trữ', { status: 'archived' });

    const response = await getPassage(auth, created._id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      _id: created._id,
      title: 'Bài của tôi',
      source: 'Tự viết',
      content: longEnough,
      isOwn: true,
      visibility: 'private'
    });
    expect(response.body).not.toHaveProperty('owner');
    expect((await getPassage(auth, String(typeTrace._id))).status).toBe(404);
    expect((await getPassage(auth, String(archived._id))).status).toBe(404);
    expect((await getPassage(bearerFor(await createUser({ email: 'other@example.com' })), created._id)).status).toBe(404);
    expect((await getPassage(auth, 'not-an-id')).status).toBe(400);
    expect((await api().get(`/api/passages/${created._id}`)).status).toBe(401);
  });
});

describe('PATCH /api/passages/:id', () => {
  it('edits an own private passage like a new one: cleaned, checked and counted again', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: created } = await addPassage(auth, newPassage({ title: 'Bài cũ' }));
    const { body: session } = await startSession(auth, { passageId: created._id });

    const response = await editPassage(auth, created._id, { title: '  <b>Bài mới</b> ', content: `Đoạn văn “mới” — ${longEnough}` });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ _id: created._id, title: 'Bài mới', wordCount: MIN_USER_PASSAGE_WORDS + 4, visibility: 'private', status: 'published' });
    const saved = (await PassageModel.findById(created._id))!;
    expect(saved.content).toBe(`Đoạn văn "mới" - ${longEnough}`);
    expect(saved.wordCount).toBe(MIN_USER_PASSAGE_WORDS + 4);

    // One field at a time: the others stay. The source is cleaned too; neither the title nor the source may become empty.
    expect((await editPassage(auth, created._id, { title: 'Tên khác' })).body).toMatchObject({ title: 'Tên khác', wordCount: MIN_USER_PASSAGE_WORDS + 4 });
    expect((await editPassage(auth, created._id, { source: ' Sách <i>Tiếng Việt</i> ' })).status).toBe(200);
    expect((await PassageModel.findById(created._id))!.source).toBe('Sách Tiếng Việt');
    expect((await editPassage(auth, created._id, { title: ' ' })).body.errors).toEqual([{ field: 'title', message: 'Title is required' }]);
    expect(await PassageModel.findById(created._id)).toMatchObject({ title: 'Tên khác', source: 'Sách Tiếng Việt' });
    // The source can be taken away again: it becomes the name of the author (no display name here).
    expect((await editPassage(auth, created._id, { source: '' })).status).toBe(200);
    expect((await PassageModel.findById(created._id))!.source).toBe('Anonymous learner');

    // A session started before the edit keeps the words it was given.
    const kept = await api().get(`/api/sessions/${session._id}`).set('Authorization', auth);
    expect(kept.body.targetWords).toEqual(longEnough.split(' '));
  });

  it('refuses a passage waiting for review or already public (409), another one (404) and bad changes (400)', async () => {
    const me = await createUser({});
    const auth = bearerFor(me);
    const waiting = await ownPassage(me, 'Đang chờ', { status: 'pending' });
    const approved = await ownPassage(me, 'Đã duyệt', { visibility: 'public' });
    const theirs = await ownPassage(await createUser({ email: 'other@example.com' }), 'Của họ');
    const typeTrace = (await PassageModel.findOne({ visibility: 'public', owner: { $exists: false } }))!;
    const { body: created } = await addPassage(auth, newPassage({ title: 'Của tôi' }));

    const pending = await editPassage(auth, String(waiting._id), { title: 'Sửa' });
    expect(pending.status).toBe(409);
    expect(pending.body.message).toBe('This passage is waiting for review: take the request back to edit it');
    // A public passage can be edited, but the approved text stays until an admin approves (passage-review.test.ts).
    const isPublic = await editPassage(auth, String(approved._id), { title: 'Sửa' });
    expect(isPublic.status).toBe(200);
    expect((await PassageModel.findById(approved._id))!.title).toBe('Đã duyệt');
    expect((await editPassage(auth, String(theirs._id), { title: 'Sửa' })).status).toBe(404);
    expect((await editPassage(auth, String(typeTrace._id), { title: 'Sửa' })).status).toBe(404);

    // Nothing to change (a status or visibility is not a field a learner may send), too short, too long.
    expect((await editPassage(auth, created._id, {})).status).toBe(400);
    expect((await editPassage(auth, created._id, { status: 'published', visibility: 'public' })).status).toBe(400);
    expect((await editPassage(auth, created._id, { content: wordsOf(MIN_USER_PASSAGE_WORDS - 1) })).status).toBe(400);
    expect((await editPassage(auth, created._id, { title: 'a'.repeat(121) })).status).toBe(400);
    expect((await api().patch(`/api/passages/${created._id}`).send({ title: 'Sửa' })).status).toBe(401);

    expect(await PassageModel.findById(created._id)).toMatchObject({ title: 'Của tôi', visibility: 'private', status: 'published' });
    expect((await PassageModel.findById(waiting._id))!.title).toBe('Đang chờ');
  });
});

describe('DELETE /api/passages/:id', () => {
  it('deletes the own passage for good, while the typing sessions on it keep their words', async () => {
    const auth = bearerFor(await createUser({}));
    const { body: passage } = await addPassage(auth, newPassage({ title: 'Tạm' }));
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

describe('English passages (ranked duel, phase 1)', () => {
  const english = { title: 'A quiet morning', content: 'The sun rose over the quiet town.', source: 'Written for TypeTrace', status: 'published', visibility: 'public', language: 'en' };

  it('never lists English passages to learners', async () => {
    await PassageModel.create(english);
    await PassageModel.create({ ...english, title: 'An English placement', isPlacement: true });
    const auth = bearerFor(await createUser({}));

    expect(titlesOf(await listPassages(auth))).not.toContain('A quiet morning');
    expect(titlesOf(await listPassages(auth, '?mode=placement'))).not.toContain('An English placement');
  });

  it('treats passages saved before the language field as Vietnamese', async () => {
    await PassageModel.collection.insertOne({
      title: 'Bài cũ chưa có ngôn ngữ',
      content: 'Đường về nhà rất đẹp.',
      source: 'Tự viết',
      ownerName: 'TypeTrace',
      visibility: 'public',
      status: 'published',
      isPlacement: false,
      wordCount: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    expect(titlesOf(await listPassages(bearerFor(await createUser({}))))).toContain('Bài cũ chưa có ngôn ngữ');
  });

  it('ignores a language sent by a learner', async () => {
    const response = await addPassage(bearerFor(await createUser({})), newPassage({ language: 'en' }));

    expect(response.status).toBe(201);
    expect((await PassageModel.findById(response.body._id))!.language).toBe('vi');
  });
});
