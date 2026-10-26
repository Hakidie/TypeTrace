import { describe, expect, it } from 'vitest';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const input = { title: 'Mùa thu', content: 'Đường về nhà rất đẹp.', source: 'Tự viết' };

const signInAdmin = async () => {
  const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' });
  return { admin, auth: bearerFor(admin) };
};

const createPassage = async (auth: string, body: object = input) =>
  (await api().post('/api/admin/passages').set('Authorization', auth).send(body)).body;

const setStatus = (auth: string, id: string, status: string) =>
  api().patch(`/api/admin/passages/${id}/status`).set('Authorization', auth).send({ status });

describe('admin passages access', () => {
  it('is open to admins only: learners get 403 and anonymous visitors 401', async () => {
    const learner = await createUser({ email: 'learner@example.com' });
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);
    const learnerAuth = bearerFor(learner);

    expect((await api().get('/api/admin/passages').set('Authorization', learnerAuth)).status).toBe(403);
    expect((await api().post('/api/admin/passages').set('Authorization', learnerAuth).send(input)).status).toBe(403);
    expect((await api().patch(`/api/admin/passages/${passage._id}`).set('Authorization', learnerAuth).send({ title: 'x' })).status).toBe(403);
    expect((await setStatus(learnerAuth, passage._id, 'published')).status).toBe(403);
    expect((await api().delete(`/api/admin/passages/${passage._id}`).set('Authorization', learnerAuth)).status).toBe(403);
    expect((await api().get('/api/admin/passages')).status).toBe(401);
    expect((await api().get('/api/admin/passages').set('Authorization', auth)).status).toBe(200);
  });
});

describe('POST /api/admin/passages', () => {
  it('creates a draft shown as TypeTrace, with the words and tags counted', async () => {
    const { admin, auth } = await signInAdmin();

    const response = await api().post('/api/admin/passages').set('Authorization', auth).send(input);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ...input,
      status: 'draft',
      isPlacement: false,
      ownerName: 'TypeTrace',
      owner: String(admin._id),
      wordCount: 5
    });
    expect(response.body.tagCounts.D_MISSING).toBe(2);
  });

  it('is always public: a visibility sent by the client is ignored', async () => {
    const { auth } = await signInAdmin();

    const response = await api()
      .post('/api/admin/passages')
      .set('Authorization', auth)
      .send({ ...input, visibility: 'private' });

    expect(response.status).toBe(201);
    expect(response.body.visibility).toBe('public');
  });

  it('ignores a status sent by the client and accepts isPlacement', async () => {
    const { auth } = await signInAdmin();

    const response = await api()
      .post('/api/admin/passages')
      .set('Authorization', auth)
      .send({ ...input, status: 'published', isPlacement: true });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'draft', isPlacement: true });
  });

  it('rejects missing or too long fields', async () => {
    const { auth } = await signInAdmin();
    const post = (body: object) => api().post('/api/admin/passages').set('Authorization', auth).send(body);

    expect((await post({ ...input, title: ' ' })).status).toBe(400);
    expect((await post({ ...input, source: '' })).status).toBe(400);
    expect((await post({ ...input, content: 'a'.repeat(5001) })).status).toBe(400);
    const tooLong = await post({ ...input, content: Array(201).fill('a').join(' ') });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.errors).toEqual([{ field: 'content', message: 'At most 200 words' }]);
    expect((await post({ ...input, content: Array(200).fill('a').join(' ') })).status).toBe(201);
    await PassageModel.deleteMany({});
    expect((await post({ title: 'Chỉ có tiêu đề' })).status).toBe(400);
    expect(await PassageModel.countDocuments()).toBe(0);
  });
});

describe('GET /api/admin/passages', () => {
  it('lists passages of every status, newest first, and filters them', async () => {
    const { auth } = await signInAdmin();
    const first = await createPassage(auth, { ...input, title: 'Thu' });
    await createPassage(auth, { ...input, title: 'Đông', source: 'Báo' });
    await setStatus(auth, first._id, 'published');

    const all = await api().get('/api/admin/passages').set('Authorization', auth);
    const published = await api().get('/api/admin/passages?status=published').set('Authorization', auth);
    const search = await api().get('/api/admin/passages?q=báo').set('Authorization', auth);

    expect(all.body).toMatchObject({ total: 2, page: 1, totalPages: 1 });
    expect(all.body.items.map((item: { title: string }) => item.title)).toEqual(['Đông', 'Thu']);
    expect(published.body.items.map((item: { title: string }) => item.title)).toEqual(['Thu']);
    expect(search.body.items.map((item: { title: string }) => item.title)).toEqual(['Đông']);
  });

  it('filters placement passages, paginates and refuses unknown sort fields', async () => {
    const { auth } = await signInAdmin();
    await createPassage(auth, { ...input, title: 'A', isPlacement: true });
    await createPassage(auth, { ...input, title: 'B' });

    const placement = await api().get('/api/admin/passages?isPlacement=true').set('Authorization', auth);
    const paged = await api().get('/api/admin/passages?limit=1&page=2&sort=title').set('Authorization', auth);

    expect(placement.body.items).toHaveLength(1);
    expect(paged.body).toMatchObject({ total: 2, totalPages: 2, items: [{ title: 'B' }] });
    expect((await api().get('/api/admin/passages?sort=owner').set('Authorization', auth)).status).toBe(400);
  });

  it('finds a passage typed without its accents, in the title or the source', async () => {
    const { auth } = await signInAdmin();
    await createPassage(auth, { ...input, title: 'Hà Nội vào thu' });
    await createPassage(auth, { ...input, title: 'Phố cổ', source: 'Báo Hà Nội mới' });
    await createPassage(auth, { ...input, title: 'Biển xanh' });

    const search = await api().get('/api/admin/passages').query({ q: 'ha noi', sort: 'title' }).set('Authorization', auth);

    expect(search.body.items.map((item: { title: string }) => item.title)).toEqual(['Hà Nội vào thu', 'Phố cổ']);
  });

  it('sorts titles in Vietnamese order: Đ right after D, accented letters with their letter', async () => {
    const { auth } = await signInAdmin();
    for (const title of ['Vịnh Hạ Long', 'Đội bóng', 'Dòng sông', 'Ánh trăng']) await createPassage(auth, { ...input, title });

    const titles = async (sort: string) =>
      (await api().get('/api/admin/passages').query({ sort }).set('Authorization', auth)).body.items.map(
        (item: { title: string }) => item.title
      );

    expect(await titles('title')).toEqual(['Ánh trăng', 'Dòng sông', 'Đội bóng', 'Vịnh Hạ Long']);
    expect(await titles('-title')).toEqual(['Vịnh Hạ Long', 'Đội bóng', 'Dòng sông', 'Ánh trăng']);
  });
});

describe('GET /api/admin/passages/:id', () => {
  it('returns one passage, 404 for an unknown id and 400 for a bad id', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);

    expect((await api().get(`/api/admin/passages/${passage._id}`).set('Authorization', auth)).body.title).toBe('Mùa thu');
    expect((await api().get('/api/admin/passages/64b7f0c2a1b2c3d4e5f60718').set('Authorization', auth)).status).toBe(404);
    expect((await api().get('/api/admin/passages/not-an-id').set('Authorization', auth)).status).toBe(400);
  });
});

describe('PATCH /api/admin/passages/:id', () => {
  it('edits the fields and counts the words and tags again', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);

    const response = await api()
      .patch(`/api/admin/passages/${passage._id}`)
      .set('Authorization', auth)
      .send({ title: 'Mùa đông', content: 'Trời lạnh quá.' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ title: 'Mùa đông', content: 'Trời lạnh quá.', wordCount: 3, status: 'draft' });
  });

  it('keeps the status and does not accept it here', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);

    const response = await api()
      .patch(`/api/admin/passages/${passage._id}`)
      .set('Authorization', auth)
      .send({ source: 'Nguồn mới', status: 'published' });

    expect(response.body).toMatchObject({ source: 'Nguồn mới', status: 'draft' });
  });

  it('needs at least one field and a valid value', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);
    const patch = (body: object) => api().patch(`/api/admin/passages/${passage._id}`).set('Authorization', auth).send(body);

    expect((await patch({})).status).toBe(400);
    expect((await patch({ title: '' })).status).toBe(400);
    expect((await api().patch('/api/admin/passages/64b7f0c2a1b2c3d4e5f60718').set('Authorization', auth).send({ title: 'x' })).status).toBe(404);
  });
});

describe('PATCH /api/admin/passages/:id/status', () => {
  it('switches freely between draft, published and archived', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);

    expect((await setStatus(auth, passage._id, 'published')).body.status).toBe('published');
    expect((await setStatus(auth, passage._id, 'archived')).body.status).toBe('archived');
    expect((await setStatus(auth, passage._id, 'published')).body.status).toBe('published');
    expect((await setStatus(auth, passage._id, 'draft')).body.status).toBe('draft');
    expect((await setStatus(auth, passage._id, 'archived')).body.status).toBe('archived'); // draft → archived
    expect((await setStatus(auth, passage._id, 'draft')).body.status).toBe('draft'); // archived → draft
  });

  it('refuses the same status and the learner statuses with 409', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);

    expect((await setStatus(auth, passage._id, 'draft')).status).toBe(409); // same status
    expect((await setStatus(auth, passage._id, 'pending')).status).toBe(409);
    expect((await setStatus(auth, passage._id, 'rejected')).status).toBe(409);
    expect((await PassageModel.findById(passage._id))!.status).toBe('draft');
  });

  it('lets an admin archive a placement passage and publish it again', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth, { ...input, isPlacement: true });
    await setStatus(auth, passage._id, 'published');

    const archived = await setStatus(auth, passage._id, 'archived');
    const edited = await api()
      .patch(`/api/admin/passages/${passage._id}`)
      .set('Authorization', auth)
      .send({ isPlacement: true, title: 'Đổi tên' });

    expect(archived.body).toMatchObject({ status: 'archived', isPlacement: true });
    expect(edited.status).toBe(200);
    expect((await setStatus(auth, passage._id, 'published')).body.status).toBe('published');
  });

  it('answers 409, not a crash, for a passage saved with an old status', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);
    await PassageModel.collection.updateOne({ title: passage.title }, { $set: { status: 'active' } });

    expect((await setStatus(auth, passage._id, 'archived')).status).toBe(409);
  });

  it('rejects an unknown status and an unknown passage', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);

    expect((await setStatus(auth, passage._id, 'deleted')).status).toBe(400);
    expect((await setStatus(auth, '64b7f0c2a1b2c3d4e5f60718', 'published')).status).toBe(404);
  });
});

describe('DELETE /api/admin/passages/:id', () => {
  it('deletes a passage nobody typed', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth);

    const response = await api().delete(`/api/admin/passages/${passage._id}`).set('Authorization', auth);

    expect(response.status).toBe(204);
    expect(await PassageModel.countDocuments()).toBe(0);
    expect((await api().delete(`/api/admin/passages/${passage._id}`).set('Authorization', auth)).status).toBe(404);
  });

  it('deletes a passage that was only opened, never typed, with those sessions', async () => {
    const { auth } = await signInAdmin();
    const learner = await createUser({ email: 'learner@example.com' });
    const passage = await createPassage(auth);
    const other = await createPassage(auth, { ...input, title: 'Khác' });
    // The Typing page starts a session as soon as it shows a passage; opening another one abandons it. No key pressed.
    const opened = { owner: learner._id, passageId: passage._id, targetWords: ['Đường'] };
    await TypingSessionModel.create([opened, { ...opened, status: 'abandoned' }]);
    await TypingSessionModel.create({ ...opened, passageId: other._id });

    const response = await api().delete(`/api/admin/passages/${passage._id}`).set('Authorization', auth);

    expect(response.status).toBe(204);
    expect(await PassageModel.exists({ _id: passage._id })).toBeNull();
    expect(await TypingSessionModel.countDocuments({ passageId: passage._id })).toBe(0);
    // The sessions of other passages stay.
    expect(await TypingSessionModel.countDocuments({ passageId: other._id })).toBe(1);
  });

  it('keeps a passage learners typed (a key pressed, or a completed session): it can only be archived', async () => {
    const { auth } = await signInAdmin();
    const learner = await createUser({ email: 'learner@example.com' });
    const opened = { owner: learner._id, targetWords: ['Đường'] };
    const begun = await createPassage(auth, { ...input, title: 'Đã gõ dở' });
    const completed = await createPassage(auth, { ...input, title: 'Đã gõ xong' });
    await TypingSessionModel.create([
      { ...opened, passageId: begun._id, status: 'abandoned', beganAt: new Date() },
      // Also a session only opened: nothing is deleted when the passage stays.
      { ...opened, passageId: begun._id, status: 'abandoned' },
      // Completed without the begin call (an older client): typed all the same.
      { ...opened, passageId: completed._id, status: 'completed' }
    ]);

    for (const passage of [begun, completed]) {
      const response = await api().delete(`/api/admin/passages/${passage._id}`).set('Authorization', auth);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Learners have typed this passage: it cannot be deleted, only archived');
    }
    expect(await PassageModel.countDocuments()).toBe(2);
    expect(await TypingSessionModel.countDocuments()).toBe(3);
    await setStatus(auth, begun._id, 'published');
    expect((await setStatus(auth, begun._id, 'archived')).body.status).toBe('archived');
  });

  it('keeps the placement passage', async () => {
    const { auth } = await signInAdmin();
    const passage = await createPassage(auth, { ...input, isPlacement: true });

    expect((await api().delete(`/api/admin/passages/${passage._id}`).set('Authorization', auth)).status).toBe(409);
    expect(await PassageModel.countDocuments()).toBe(1);
  });
});

describe('what learners can practise', () => {
  it('never offers a draft, an archived or a private passage to other learners', async () => {
    const { auth } = await signInAdmin();
    const learner = await createUser({ email: 'learner@example.com' });
    const other = await createUser({ email: 'other@example.com' });
    const live = await createPassage(auth, { ...input, title: 'Đã đăng' });
    await setStatus(auth, live._id, 'published');
    const privatePassage = await PassageModel.create({
      ...input,
      title: 'Riêng',
      status: 'published',
      visibility: 'private',
      owner: learner._id
    });
    const start = (userAuth: string, passageId: string) =>
      api().post('/api/sessions').set('Authorization', userAuth).send({ passageId });

    expect((await start(bearerFor(other), live._id)).status).toBe(201);
    expect((await start(bearerFor(other), String(privatePassage._id))).status).toBe(400);
    // Random practice picks only published public passages: the single candidate is `live`.
    const random = await api().post('/api/sessions').set('Authorization', bearerFor(other)).send({});
    expect(random.body.passageId).toBe(live._id);
  });

  it('offers only published passages', async () => {
    const { auth } = await signInAdmin();
    const learner = await createUser({ email: 'learner@example.com' });
    const draft = await createPassage(auth, { ...input, title: 'Nháp' });
    const live = await createPassage(auth, { ...input, title: 'Đã đăng' });
    await setStatus(auth, live._id, 'published');
    const start = (passageId?: string) =>
      api().post('/api/sessions').set('Authorization', bearerFor(learner)).send(passageId ? { passageId } : {});

    expect((await start(draft._id)).status).toBe(400);
    expect((await start(live._id)).status).toBe(201);
    await setStatus(auth, live._id, 'archived');
    expect((await start(live._id)).status).toBe(400);
    expect((await start()).status).toBe(404);
  });
});
