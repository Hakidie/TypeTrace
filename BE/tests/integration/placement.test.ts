import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { PassageModel } from '../../src/models/passage.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const getPlacement = (authorization: string) => api().get('/api/placement').set('Authorization', authorization);

// The tests start with an empty database: load the starter passages (several placement passages among them) first.
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
});

describe('GET /api/placement', () => {
  it('needs a signed-in user', async () => {
    expect((await api().get('/api/placement')).status).toBe(401);
  });

  it('returns one published placement passage with its public fields only', async () => {
    const response = await getPlacement(bearerFor(await createUser({})));

    expect(response.status).toBe(200);
    const passage = (await PassageModel.findById(response.body._id))!;
    expect(passage).toMatchObject({ isPlacement: true, status: 'published' });
    expect(response.body).toEqual({
      _id: String(passage._id),
      title: passage.title,
      content: passage.content,
      source: passage.source,
      ownerName: 'TypeTrace',
      wordCount: passage.wordCount
    });
  });

  it('picks at random among the published placement passages, never a practice or hidden one', async () => {
    await PassageModel.updateOne({ title: 'Bài kiểm tra đầu vào' }, { status: 'archived' });
    const auth = bearerFor(await createUser({}));
    const allowedIds = (await PassageModel.find({ isPlacement: true, status: 'published' })).map((p) => String(p._id));
    expect(allowedIds.length).toBeGreaterThan(1);

    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) seen.add((await getPlacement(auth)).body._id);

    expect([...seen].every((id) => allowedIds.includes(id))).toBe(true);
    expect(seen.size).toBeGreaterThan(1); // not always the same passage
  });

  it('never shows who created a placement passage', async () => {
    await PassageModel.updateMany({ isPlacement: true }, { status: 'archived' });
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await PassageModel.create({
      title: 'Bài của admin', content: 'Đây là đoạn văn.', source: 'Tự viết', isPlacement: true, status: 'published', owner: admin._id
    });

    const response = await getPlacement(bearerFor(await createUser({})));

    expect(response.body.title).toBe('Bài của admin');
    expect(response.body).not.toHaveProperty('owner');
  });

  it('answers 404 when there is no published placement passage', async () => {
    await PassageModel.updateMany({ isPlacement: true }, { status: 'archived' });

    const response = await getPlacement(bearerFor(await createUser({})));

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No placement passage');
  });
});
