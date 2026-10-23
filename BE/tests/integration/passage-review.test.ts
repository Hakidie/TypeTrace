// SCRUM-176: a learner asks for one of their passages to become public, an admin approves it or turns it down.
import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import {
  ANONYMOUS_OWNER_NAME,
  MAX_USER_PASSAGES,
  MIN_USER_PASSAGE_WORDS,
  PassageModel,
  REVIEW_NOTE_MAX,
  SYSTEM_OWNER_NAME
} from '../../src/models/passage.model';
import { UserModel } from '../../src/models/user.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const longEnough = Array.from({ length: MIN_USER_PASSAGE_WORDS }, () => 'chữ').join(' ');

const signIn = async (email: string, extra: { displayName?: string; role?: 'admin' } = {}) => {
  const user = await createUser({ email, ...extra });
  return { user, auth: bearerFor(user) };
};

const addPassage = async (auth: string, title: string) =>
  (await api().post('/api/passages').set('Authorization', auth).send({ title, source: 'Tự viết', content: longEnough })).body as {
    _id: string;
  };
const requestPublic = (auth: string, id: string, body: object = {}) =>
  api().post(`/api/passages/${id}/publish-request`).set('Authorization', auth).send(body);
const withdraw = (auth: string, id: string) => api().delete(`/api/passages/${id}/publish-request`).set('Authorization', auth);
const listPassages = (auth: string, query = '') => api().get(`/api/passages${query}`).set('Authorization', auth);
const startSession = (auth: string, body: object) => api().post('/api/sessions').set('Authorization', auth).send(body);
const adminList = (auth: string, query: string) => api().get(`/api/admin/passages${query}`).set('Authorization', auth);
const approve = (auth: string, id: string) => api().patch(`/api/admin/passages/${id}/approve`).set('Authorization', auth);
const reject = (auth: string, id: string, body: object) =>
  api().patch(`/api/admin/passages/${id}/reject`).set('Authorization', auth).send(body);
const bulk = (auth: string, action: 'approve' | 'reject', body: object) =>
  api().post(`/api/admin/passages/bulk-${action}`).set('Authorization', auth).send(body);

type ListItem = { _id: string; title: string; status: string; visibility: string; reviewNote?: string; isOwn: boolean; ownerName: string };
const itemsOf = (response: { body: { items: ListItem[] } }) => response.body.items;
const titlesOf = (response: { body: { items: { title: string }[] } }) => response.body.items.map((item) => item.title);
const saved = async (id: string) => (await PassageModel.findById(id))!.toObject();

// The tests start with an empty database: load the starter passages first.
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
});

describe('POST /api/passages/:id/publish-request', () => {
  it('puts the own passage in the review queue, still private, and its owner can still type it', async () => {
    const lan = await signIn('lan@example.com', { displayName: 'Lan' });
    const other = await signIn('other@example.com');
    const { _id } = await addPassage(lan.auth, 'Bài của Lan');

    const response = await requestPublic(lan.auth, _id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ _id, status: 'pending', visibility: 'private', isOwn: true });
    expect(await saved(_id)).toMatchObject({ status: 'pending', visibility: 'private' });
    expect(itemsOf(await listPassages(lan.auth, '?visibility=private'))).toEqual([expect.objectContaining({ _id, status: 'pending' })]);
    expect(titlesOf(await listPassages(other.auth))).not.toContain('Bài của Lan');
    // The owner exception: only the owner may type a passage waiting for review.
    expect((await startSession(lan.auth, { passageId: _id })).status).toBe(201);
    expect((await startSession(other.auth, { passageId: _id })).status).toBe(400);
  });

  it('answers 409 when it already waits or is already public, 404 for a passage that is not theirs', async () => {
    const lan = await signIn('lan@example.com');
    const other = await signIn('other@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    const { _id } = await addPassage(lan.auth, 'Bài của Lan');
    const typeTrace = (await PassageModel.findOne({ visibility: 'public' }))!;

    expect((await requestPublic(lan.auth, _id)).status).toBe(200);
    const again = await requestPublic(lan.auth, _id);
    expect(again.status).toBe(409);
    expect(again.body.message).toBe('This passage is already waiting for review');
    expect((await requestPublic(other.auth, _id)).status).toBe(404);
    expect((await requestPublic(lan.auth, String(typeTrace._id))).status).toBe(404);

    await approve(admin.auth, _id);
    const approved = await requestPublic(lan.auth, _id);
    expect(approved.status).toBe(409);
    expect(approved.body.message).toBe('This passage is already public');

    expect((await requestPublic(lan.auth, 'not-an-id')).status).toBe(400);
    expect((await api().post(`/api/passages/${_id}/publish-request`)).status).toBe(401);
  });
});

describe('DELETE /api/passages/:id/publish-request', () => {
  it('takes the request back before an admin decides', async () => {
    const lan = await signIn('lan@example.com');
    const other = await signIn('other@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    const { _id } = await addPassage(lan.auth, 'Bài của Lan');
    await requestPublic(lan.auth, _id);

    expect((await withdraw(other.auth, _id)).status).toBe(404);
    const response = await withdraw(lan.auth, _id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'published', visibility: 'private' });
    expect(await saved(_id)).toMatchObject({ status: 'published', visibility: 'private' });
    const twice = await withdraw(lan.auth, _id);
    expect(twice.status).toBe(409);
    expect(twice.body.message).toBe('This passage is not waiting for review');
    // Nothing left to decide.
    expect((await approve(admin.auth, _id)).status).toBe(409);
  });
});

describe('only an admin makes a passage public', () => {
  it('ignores a status or a visibility sent by the client', async () => {
    const lan = await signIn('lan@example.com');
    const other = await signIn('other@example.com');
    const created = await api()
      .post('/api/passages')
      .set('Authorization', lan.auth)
      .send({ title: 'Tự công khai', source: 'Tự viết', content: longEnough, status: 'published', visibility: 'public' });
    expect(await saved(created.body._id)).toMatchObject({ status: 'published', visibility: 'private' });

    const asked = await requestPublic(lan.auth, created.body._id, { status: 'published', visibility: 'public' });
    expect(asked.body).toMatchObject({ status: 'pending', visibility: 'private' });

    // A session cannot be opened on someone else's passage by sending a status or a visibility either.
    const session = await startSession(other.auth, { passageId: created.body._id, status: 'published', visibility: 'public' });
    expect(session.status).toBe(400);
    expect(titlesOf(await listPassages(other.auth))).not.toContain('Tự công khai');
  });

  it('keeps the review endpoints for admins: learners get 403 and visitors 401', async () => {
    const lan = await signIn('lan@example.com');
    const { _id } = await addPassage(lan.auth, 'Bài của Lan');
    await requestPublic(lan.auth, _id);

    expect((await approve(lan.auth, _id)).status).toBe(403);
    expect((await reject(lan.auth, _id, { reason: 'Không' })).status).toBe(403);
    expect((await bulk(lan.auth, 'approve', { ids: [_id] })).status).toBe(403);
    expect((await bulk(lan.auth, 'reject', { ids: [_id], reason: 'Không' })).status).toBe(403);
    expect((await adminList(lan.auth, '?status=pending')).status).toBe(403);
    expect((await api().patch(`/api/admin/passages/${_id}/approve`)).status).toBe(401);
    expect((await api().post('/api/admin/passages/bulk-approve').send({ ids: [_id] })).status).toBe(401);
    expect((await saved(_id)).status).toBe('pending');
  });

  it('does not let the status endpoint put a passage in review or take it out', async () => {
    const lan = await signIn('lan@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    const waiting = await addPassage(lan.auth, 'Đang chờ');
    const notAsked = await addPassage(lan.auth, 'Chưa gửi');
    await requestPublic(lan.auth, waiting._id);
    const setStatus = (id: string, status: string) =>
      api().patch(`/api/admin/passages/${id}/status`).set('Authorization', admin.auth).send({ status });

    expect((await setStatus(notAsked._id, 'pending')).status).toBe(409);
    expect((await setStatus(waiting._id, 'published')).status).toBe(409);
    expect((await setStatus(waiting._id, 'archived')).status).toBe(409);
    expect((await saved(waiting._id)).status).toBe('pending');
    expect((await saved(notAsked._id)).status).toBe('published');
  });
});

describe('the passage bank: GET /api/admin/passages?visibility=public', () => {
  it('leaves out the learners private passages, waiting for review or not, but keeps the approved ones and the drafts', async () => {
    const lan = await signIn('lan@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    await addPassage(lan.auth, 'Riêng của Lan');
    await requestPublic(lan.auth, (await addPassage(lan.auth, 'Đang chờ'))._id);
    const approved = await addPassage(lan.auth, 'Đã duyệt');
    await requestPublic(lan.auth, approved._id);
    await approve(admin.auth, approved._id);
    await api().post('/api/admin/passages').set('Authorization', admin.auth).send({ title: 'Nháp', content: longEnough, source: 'TypeTrace' });

    const bank = titlesOf(await adminList(admin.auth, '?visibility=public&limit=100'));

    expect(bank).toEqual(expect.arrayContaining(['Đã duyệt', 'Nháp']));
    expect(bank).not.toContain('Riêng của Lan');
    expect(bank).not.toContain('Đang chờ');
    expect((await adminList(admin.auth, '?visibility=secret')).status).toBe(400);
  });
});

describe('the review queue: GET /api/admin/passages?status=pending', () => {
  it('lists the requests with their text and author, oldest first, with search and pages', async () => {
    const lan = await signIn('lan@example.com', { displayName: 'Lan' });
    const minh = await signIn('minh@example.com', { displayName: 'Minh' });
    const admin = await signIn('admin@example.com', { role: 'admin' });
    for (const [learner, title] of [[lan, 'Sông quê'], [minh, 'Biển xanh'], [lan, 'Núi rừng']] as const) {
      await requestPublic(learner.auth, (await addPassage(learner.auth, title))._id);
    }
    await addPassage(lan.auth, 'Chưa gửi');

    const queue = await adminList(admin.auth, '?status=pending&sort=updatedAt');
    expect(queue.status).toBe(200);
    expect(queue.body.total).toBe(3);
    expect(titlesOf(queue)).toEqual(['Sông quê', 'Biển xanh', 'Núi rừng']);
    expect(queue.body.items[0]).toMatchObject({ content: longEnough, ownerName: 'Lan', status: 'pending', visibility: 'private' });

    expect(titlesOf(await adminList(admin.auth, `?status=pending&q=${encodeURIComponent('biển')}`))).toEqual(['Biển xanh']);
    const second = await adminList(admin.auth, '?status=pending&sort=updatedAt&limit=2&page=2');
    expect(second.body).toMatchObject({ page: 2, totalPages: 2 });
    expect(titlesOf(second)).toEqual(['Núi rừng']);
  });
});

describe('PATCH /api/admin/passages/:id/approve', () => {
  it('makes the passage public for every learner, still shown with the name of its author', async () => {
    const lan = await signIn('lan@example.com', { displayName: 'Lan' });
    const other = await signIn('other@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    const { _id } = await addPassage(lan.auth, 'Bài của Lan');
    await requestPublic(lan.auth, _id);
    await reject(admin.auth, _id, { reason: 'Sửa lại tiêu đề' });
    await requestPublic(lan.auth, _id);

    const response = await approve(admin.auth, _id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'published', visibility: 'public', ownerName: 'Lan' });
    expect(response.body).not.toHaveProperty('reviewNote');
    const seen = itemsOf(await listPassages(other.auth, '?visibility=public')).find((item) => item._id === _id);
    expect(seen).toMatchObject({ ownerName: 'Lan', visibility: 'public', isOwn: false });
    expect((await startSession(other.auth, { passageId: _id })).status).toBe(201);
    expect(itemsOf(await listPassages(lan.auth)).find((item) => item._id === _id)).toMatchObject({ isOwn: true, visibility: 'public' });

    // Public now: the learner can no longer delete it, and there is nothing left to decide.
    const removed = await api().delete(`/api/passages/${_id}`).set('Authorization', lan.auth);
    expect(removed.status).toBe(409);
    expect(removed.body.message).toBe('This passage is public now: only an admin can remove it');
    expect((await approve(admin.auth, _id)).status).toBe(409);
    expect((await approve(admin.auth, '64b7f0c2a1b2c3d4e5f60718')).status).toBe(404);
    expect((await approve(admin.auth, 'not-an-id')).status).toBe(400);
  });
});

describe('the author shown once a passage is public', () => {
  it('is never the learner email: without a display name it is "Anonymous learner"', async () => {
    const noName = await signIn('student06@example.com');
    const other = await signIn('other@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    const { _id } = await addPassage(noName.auth, 'Bài không tên');
    await requestPublic(noName.auth, _id);
    // Still private: only the learner and the admins see it, so the admins can tell who asked.
    expect((await adminList(admin.auth, '?status=pending')).body.items[0]).toMatchObject({ _id, ownerName: 'student06@example.com' });

    const response = await approve(admin.auth, _id);

    expect(response.body).toMatchObject({ visibility: 'public', ownerName: ANONYMOUS_OWNER_NAME });
    const seen = await listPassages(other.auth, '?visibility=public');
    expect(itemsOf(seen).find((item) => item._id === _id)).toMatchObject({ ownerName: ANONYMOUS_OWNER_NAME });
    expect(JSON.stringify(seen.body)).not.toContain('student06@example.com');
  });

  it('is the display name the learner has when it is approved, one at a time or many at once', async () => {
    const lan = await signIn('lan@example.com');
    const minh = await signIn('minh@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    const one = await addPassage(lan.auth, 'Một');
    const two = await addPassage(minh.auth, 'Hai');
    const three = await addPassage(lan.auth, 'Ba');
    for (const [learner, passage] of [[lan, one], [minh, two], [lan, three]] as const) await requestPublic(learner.auth, passage._id);
    // Lan sets a display name after writing the passages; Minh never does.
    await UserModel.updateOne({ _id: lan.user._id }, { displayName: 'Lan' });

    expect((await approve(admin.auth, one._id)).body.ownerName).toBe('Lan');
    expect((await bulk(admin.auth, 'approve', { ids: [two._id, three._id] })).body).toEqual({ updated: 2 });

    expect(await saved(two._id)).toMatchObject({ visibility: 'public', ownerName: ANONYMOUS_OWNER_NAME });
    expect(await saved(three._id)).toMatchObject({ visibility: 'public', ownerName: 'Lan' });
  });

  it('stays TypeTrace for a passage an admin wrote as their own', async () => {
    const admin = await signIn('admin@example.com', { role: 'admin', displayName: 'Demo Admin' });
    const { _id } = await addPassage(admin.auth, 'Bài của admin');
    await requestPublic(admin.auth, _id);

    expect((await approve(admin.auth, _id)).body).toMatchObject({ visibility: 'public', ownerName: SYSTEM_OWNER_NAME });
  });
});

describe('PATCH /api/admin/passages/:id/reject', () => {
  it('keeps the passage private with a reason only its owner sees; the owner may ask again', async () => {
    const lan = await signIn('lan@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    const { _id } = await addPassage(lan.auth, 'Bài của Lan');
    await requestPublic(lan.auth, _id);

    for (const body of [{}, { reason: '   ' }, { reason: 'a'.repeat(REVIEW_NOTE_MAX + 1) }]) {
      expect((await reject(admin.auth, _id, body)).status).toBe(400);
    }
    const response = await reject(admin.auth, _id, { reason: '  Nội dung chưa phù hợp  ' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'rejected', visibility: 'private', reviewNote: 'Nội dung chưa phù hợp' });
    expect(itemsOf(await listPassages(lan.auth, '?visibility=private'))[0]).toMatchObject({
      status: 'rejected',
      reviewNote: 'Nội dung chưa phù hợp'
    });
    expect((await startSession(lan.auth, { passageId: _id })).status).toBe(201);
    expect((await reject(admin.auth, _id, { reason: 'Lần nữa' })).status).toBe(409);

    // Turned down is never published: neither the published passages nor the passage bank (public ones) hold it.
    expect(titlesOf(await adminList(admin.auth, '?status=published&limit=100'))).not.toContain('Bài của Lan');
    expect(titlesOf(await adminList(admin.auth, '?visibility=public&limit=100'))).not.toContain('Bài của Lan');
    expect(titlesOf(await adminList(admin.auth, '?status=rejected'))).toEqual(['Bài của Lan']);
    expect(titlesOf(await listPassages((await signIn('other@example.com')).auth))).not.toContain('Bài của Lan');

    // The owner may fix it (it stays turned down, with the reason) and ask again, which clears the reason.
    const edited = await api().patch(`/api/passages/${_id}`).set('Authorization', lan.auth).send({ title: 'Bài đã sửa' });
    expect(edited.body).toMatchObject({ title: 'Bài đã sửa', status: 'rejected', reviewNote: 'Nội dung chưa phù hợp' });
    expect((await requestPublic(lan.auth, _id)).body).toMatchObject({ status: 'pending' });
    expect((await saved(_id)).reviewNote).toBeUndefined();
  });
});

describe('POST /api/admin/passages/bulk-approve and bulk-reject', () => {
  it('decides on many passages at once, only the ones still waiting, and says how many changed', async () => {
    const lan = await signIn('lan@example.com');
    const admin = await signIn('admin@example.com', { role: 'admin' });
    const [first, second, notAsked, withdrawn] = await Promise.all(
      ['Thứ nhất', 'Thứ hai', 'Chưa gửi', 'Đã rút'].map((title) => addPassage(lan.auth, title))
    );
    for (const passage of [first, second, withdrawn]) await requestPublic(lan.auth, passage._id);
    await withdraw(lan.auth, withdrawn._id);

    const approved = await bulk(admin.auth, 'approve', { ids: [first._id, notAsked._id, withdrawn._id] });
    expect(approved.body).toEqual({ updated: 1 });
    expect(await saved(first._id)).toMatchObject({ status: 'published', visibility: 'public' });
    expect(await saved(notAsked._id)).toMatchObject({ status: 'published', visibility: 'private' });

    const rejected = await bulk(admin.auth, 'reject', { ids: [second._id, first._id], reason: 'Trùng nội dung' });
    expect(rejected.body).toEqual({ updated: 1 });
    expect(await saved(second._id)).toMatchObject({ status: 'rejected', visibility: 'private', reviewNote: 'Trùng nội dung' });
    expect(await saved(first._id)).toMatchObject({ visibility: 'public' });

    expect((await bulk(admin.auth, 'reject', { ids: [second._id] })).status).toBe(400);
    expect((await bulk(admin.auth, 'approve', { ids: [] })).status).toBe(400);
    expect((await bulk(admin.auth, 'approve', { ids: ['not-an-id'] })).status).toBe(400);
  });
});

describe('own passages waiting for review', () => {
  it('count in the limit, while the approved ones do not', async () => {
    const lan = await signIn('lan@example.com');
    const base = { content: longEnough, source: 'Tự viết', owner: lan.user._id, visibility: 'private' };
    for (let i = 1; i < MAX_USER_PASSAGES; i += 1) await PassageModel.create({ ...base, title: `Bài ${i}`, status: 'published' });
    const waiting = await PassageModel.create({ ...base, title: 'Đang chờ', status: 'pending' });

    const add = () => api().post('/api/passages').set('Authorization', lan.auth).send({ title: 'Mới', source: 'Tự viết', content: longEnough });
    const full = await add();
    expect(full.status).toBe(400);
    expect(full.body.message).toBe(`You can have at most ${MAX_USER_PASSAGES} passages`);

    await PassageModel.updateOne({ _id: waiting._id }, { status: 'published', visibility: 'public' });
    expect((await add()).status).toBe(201);
  });

  it('can still be deleted by their owner', async () => {
    const lan = await signIn('lan@example.com');
    const { _id } = await addPassage(lan.auth, 'Bài của Lan');
    await requestPublic(lan.auth, _id);

    expect((await api().delete(`/api/passages/${_id}`).set('Authorization', lan.auth)).status).toBe(204);
    expect(await PassageModel.exists({ _id })).toBeNull();
  });
});
