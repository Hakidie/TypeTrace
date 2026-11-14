import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

type Learner = Awaited<ReturnType<typeof createUser>>;

const patch = (learner: Learner, body: unknown) =>
  api().patch('/api/profile/settings').set('Authorization', bearerFor(learner)).send(body as object);

describe('PATCH /api/profile/settings: typing font size and app font', () => {
  it('saves the font size and the font alone, keeping the other settings', async () => {
    const learner = await createUser();

    expect((await patch(learner, { typingFontSizeRem: 1.5 })).status).toBe(200);
    expect((await patch(learner, { fontFamily: 'lexend' })).status).toBe(200);

    const saved = (await UserModel.findById(learner._id))!;
    expect(saved.settings).toMatchObject({ typingFontSizeRem: 1.5, fontFamily: 'lexend', typingLanguage: 'vi', mode: 'dark' });
  });

  it('still saves the typing language alone', async () => {
    const learner = await createUser();

    const response = await patch(learner, { typingLanguage: 'en' });

    expect(response.status).toBe(200);
    expect(response.body.settings.typingLanguage).toBe('en');
  });

  it('accepts the edges 1 and 2.5', async () => {
    const learner = await createUser();

    expect((await patch(learner, { typingFontSizeRem: 1 })).status).toBe(200);
    expect((await patch(learner, { typingFontSizeRem: 2.5 })).status).toBe(200);
  });

  it.each([0.875, 2.625, 1.3, '2'])('rejects the font size %s', async (typingFontSizeRem) => {
    const learner = await createUser();

    expect((await patch(learner, { typingFontSizeRem })).status).toBe(400);
  });

  it('rejects an unknown font', async () => {
    const learner = await createUser();

    expect((await patch(learner, { fontFamily: 'comic-sans' })).status).toBe(400);
  });

  it('rejects an empty body', async () => {
    const learner = await createUser();

    expect((await patch(learner, {})).status).toBe(400);
  });

  it('answers 401 without a token', async () => {
    expect((await api().patch('/api/profile/settings').send({ fontFamily: 'lexend' })).status).toBe(401);
  });

  it('does not touch the theme settings', async () => {
    const learner = await createUser();
    const theme = new Types.ObjectId();
    await UserModel.updateOne({ _id: learner._id }, { $set: { 'settings.darkTheme': theme, 'settings.mode': 'light' } });

    await patch(learner, { typingFontSizeRem: 1.25, fontFamily: 'noto-serif' });

    const saved = (await UserModel.findById(learner._id))!;
    expect(saved.settings.darkTheme).toEqual(theme);
    expect(saved.settings.mode).toBe('light');
  });

  it('an account without the new fields reads the defaults', async () => {
    const learner = await createUser();
    await UserModel.collection.updateOne(
      { _id: learner._id },
      { $unset: { 'settings.typingFontSizeRem': '', 'settings.fontFamily': '' } }
    );

    const me = await api().get('/api/auth/me').set('Authorization', bearerFor(learner));

    expect(me.body.settings).toMatchObject({ typingFontSizeRem: 2, fontFamily: 'jetbrains-mono' });
  });
});

describe('GET /api/profile/settings', () => {
  it('returns the defaults for a new account and nothing private', async () => {
    const learner = await createUser();

    const response = await api().get('/api/profile/settings').set('Authorization', bearerFor(learner));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      timezone: 'Asia/Ho_Chi_Minh',
      typingLanguage: 'vi',
      typingFontSizeRem: 2,
      fontFamily: 'jetbrains-mono'
    });
  });

  it('returns what PATCH saved', async () => {
    const learner = await createUser();
    await patch(learner, { typingFontSizeRem: 1.75, fontFamily: 'jetbrains-mono', typingLanguage: 'en' });

    const response = await api().get('/api/profile/settings').set('Authorization', bearerFor(learner));

    expect(response.body).toMatchObject({ typingFontSizeRem: 1.75, fontFamily: 'jetbrains-mono', typingLanguage: 'en' });
  });

  it('answers 401 without a token', async () => {
    expect((await api().get('/api/profile/settings')).status).toBe(401);
  });
});
