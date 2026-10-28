import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api';
import { UserModel } from '../../src/models/user.model';
import { cloudinaryRecorder } from '../helpers/cloudinary-recorder';
import { bearerFor, createUser } from '../helpers/user-factory';

const SECRET_FIELDS = [
  'password',
  'otpCode',
  'otpExpiresAt',
  'resetToken',
  'resetTokenExpiresAt'
];

const pngBuffer = (byteLength = 64) => Buffer.alloc(byteLength, 1);

describe('PATCH /api/profile', () => {
  it('updates the editable fields and hides every secret field', async () => {
    const user = await createUser({});

    const response = await api()
      .patch('/api/profile')
      .set('Authorization', bearerFor(user))
      .send({ displayName: 'Alice', bio: 'Hello', phone: '0123456789' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ displayName: 'Alice', bio: 'Hello', phone: '0123456789' });
    for (const field of SECRET_FIELDS) {
      expect(response.body).not.toHaveProperty(field);
    }
  });

  it('trims the stored values', async () => {
    const user = await createUser({});

    const response = await api()
      .patch('/api/profile')
      .set('Authorization', bearerFor(user))
      .send({ displayName: '  Alice  ' });

    expect(response.body.displayName).toBe('Alice');
  });

  it('requires authentication', async () => {
    const response = await api().patch('/api/profile').send({ displayName: 'Alice' });
    expect(response.status).toBe(401);
  });

  it('rejects invalid values with 400', async () => {
    const user = await createUser({});

    const response = await api()
      .patch('/api/profile')
      .set('Authorization', bearerFor(user))
      .send({ bio: 'b'.repeat(201) });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('bio');
  });

  it('returns 404 when the authenticated user no longer exists', async () => {
    const user = await createUser({});
    const authorization = bearerFor(user);
    await UserModel.deleteOne({ _id: user._id });

    const response = await api()
      .patch('/api/profile')
      .set('Authorization', authorization)
      .send({ displayName: 'Alice' });

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/profile/settings (SCRUM-31)', () => {
  const patchSettings = (authorization: string, body: Record<string, unknown>) =>
    api().patch('/api/profile/settings').set('Authorization', authorization).send(body);

  it('saves the time zone as the browser wrote it (trimmed) and answers the user without secret fields', async () => {
    const user = await createUser({});

    // Node 24 calls this zone Asia/Calcutta: the browser would then see another zone and send its own again.
    const response = await patchSettings(bearerFor(user), { timezone: '  Asia/Kolkata ' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ _id: String(user._id), email: user.email });
    expect(response.body.settings.timezone).toBe('Asia/Kolkata');
    for (const field of SECRET_FIELDS) {
      expect(response.body).not.toHaveProperty(field);
    }
    expect((await UserModel.findById(user._id))!.settings.timezone).toBe('Asia/Kolkata');
  });

  it('keeps the mode and the themes, whatever else the body says', async () => {
    const user = await createUser({});
    const lightTheme = new Types.ObjectId();
    await UserModel.updateOne({ _id: user._id }, { $set: { 'settings.mode': 'light', 'settings.lightTheme': lightTheme } });

    const response = await patchSettings(bearerFor(user), { timezone: 'UTC', mode: 'dark', darkTheme: String(new Types.ObjectId()) });

    expect(response.status).toBe(200);
    expect(response.body.settings).toEqual({ mode: 'light', darkTheme: null, lightTheme: String(lightTheme), timezone: 'UTC' });
  });

  it('answers 400 for a missing, empty, unknown or too long zone, and keeps the saved one', async () => {
    const user = await createUser({});
    // Not the default zone, so a reset to the default would show.
    expect((await patchSettings(bearerFor(user), { timezone: 'UTC' })).status).toBe(200);
    const bodies = [{}, { timezone: '' }, { timezone: '   ' }, { timezone: 'Mars/Olympus' }, { timezone: 'A'.repeat(65) }, { timezone: 7 }];

    for (const body of bodies) {
      const response = await patchSettings(bearerFor(user), body);
      expect(response.status).toBe(400);
      expect(response.body.errors[0].field).toBe('timezone');
    }
    expect((await UserModel.findById(user._id))!.settings.timezone).toBe('UTC');
  });

  it('requires authentication', async () => {
    expect((await api().patch('/api/profile/settings').send({ timezone: 'UTC' })).status).toBe(401);
  });

  it('answers 404 when the signed-in user no longer exists', async () => {
    const user = await createUser({});
    const authorization = bearerFor(user);
    await UserModel.deleteOne({ _id: user._id });

    expect((await patchSettings(authorization, { timezone: 'UTC' })).status).toBe(404);
  });

  it('sends the zone with every user, the default one for an account that never sent one', async () => {
    const user = await createUser({});
    const old = await createUser({ email: 'old@example.com' });
    await UserModel.collection.updateOne({ _id: old._id }, { $unset: { 'settings.timezone': '' } });
    const ancient = await createUser({ email: 'ancient@example.com' });
    await UserModel.collection.updateOne({ _id: ancient._id }, { $unset: { settings: '' } });

    for (const account of [user, old, ancient]) {
      const me = await api().get('/api/auth/me').set('Authorization', bearerFor(account));
      expect(me.body.settings.timezone).toBe('Asia/Ho_Chi_Minh');
    }
    const updated = await api().patch('/api/profile').set('Authorization', bearerFor(old)).send({ displayName: 'Old' });
    expect(updated.body.settings.timezone).toBe('Asia/Ho_Chi_Minh');
  });
});

describe('POST /api/profile/avatar', () => {
  it('uploads the image and persists the returned URL', async () => {
    const user = await createUser({});

    const response = await api()
      .post('/api/profile/avatar')
      .set('Authorization', bearerFor(user))
      .attach('avatar', pngBuffer(), { filename: 'avatar.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.avatarUrl).toBe(cloudinaryRecorder.uploadResult.secure_url);
    expect(cloudinaryRecorder.uploads).toEqual([{ folder: 'avatars', byteLength: 64 }]);
    expect((await UserModel.findById(user._id))?.avatarUrl).toBe(
      cloudinaryRecorder.uploadResult.secure_url
    );
    for (const field of SECRET_FIELDS) {
      expect(response.body.user).not.toHaveProperty(field);
    }
  });

  it('deletes the previous avatar, deriving its public id from the stored URL', async () => {
    const user = await createUser({
      avatarUrl: 'https://res.cloudinary.com/test-cloud/image/upload/v1700000000/avatars/old-avatar.png'
    });

    await api()
      .post('/api/profile/avatar')
      .set('Authorization', bearerFor(user))
      .attach('avatar', pngBuffer(), { filename: 'avatar.png', contentType: 'image/png' });

    expect(cloudinaryRecorder.destroyed).toEqual(['avatars/old-avatar']);
  });

  it('deletes the previous avatar by its stored public id', async () => {
    const user = await createUser({});
    const upload = () =>
      api()
        .post('/api/profile/avatar')
        .set('Authorization', bearerFor(user))
        .attach('avatar', pngBuffer(), { filename: 'avatar.png', contentType: 'image/png' });

    await upload();
    cloudinaryRecorder.uploadResult = {
      secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v2/avatars/nested/second.png',
      public_id: 'avatars/nested/second'
    };
    await upload();
    await upload();

    expect(cloudinaryRecorder.destroyed).toEqual(['avatars/new-avatar', 'avatars/nested/second']);
    expect((await UserModel.findById(user._id))?.avatarPublicId).toBe('avatars/nested/second');
  });

  it('does not call delete when the user has no avatar yet', async () => {
    const user = await createUser({});

    await api()
      .post('/api/profile/avatar')
      .set('Authorization', bearerFor(user))
      .attach('avatar', pngBuffer(), { filename: 'avatar.png', contentType: 'image/png' });

    expect(cloudinaryRecorder.destroyed).toEqual([]);
  });

  it('still succeeds when deleting the previous avatar fails', async () => {
    cloudinaryRecorder.destroyError = new Error('cloudinary down');
    const user = await createUser({
      avatarUrl: 'https://res.cloudinary.com/test-cloud/image/upload/v1/avatars/old-avatar.png'
    });

    const response = await api()
      .post('/api/profile/avatar')
      .set('Authorization', bearerFor(user))
      .attach('avatar', pngBuffer(), { filename: 'avatar.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.avatarUrl).toBe(cloudinaryRecorder.uploadResult.secure_url);
  });

  it('answers 400 when no file is attached', async () => {
    const user = await createUser({});

    const response = await api()
      .post('/api/profile/avatar')
      .set('Authorization', bearerFor(user));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('No file provided');
  });

  it('requires authentication and never reaches Cloudinary', async () => {
    const response = await api()
      .post('/api/profile/avatar')
      .attach('avatar', pngBuffer(), { filename: 'avatar.png', contentType: 'image/png' });

    expect(response.status).toBe(401);
    expect(cloudinaryRecorder.uploads).toEqual([]);
  });

  it('rejects a non-image file with 400 without uploading it', async () => {
    const user = await createUser({});

    const response = await api()
      .post('/api/profile/avatar')
      .set('Authorization', bearerFor(user))
      .attach('avatar', Buffer.from('%PDF-1.4'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Only JPEG, PNG, WebP, and GIF images are allowed');
    expect(cloudinaryRecorder.uploads).toEqual([]);
  });

  it('rejects a file larger than 5 MB with 413 without uploading it', async () => {
    const user = await createUser({});

    const response = await api()
      .post('/api/profile/avatar')
      .set('Authorization', bearerFor(user))
      .attach('avatar', pngBuffer(6 * 1024 * 1024), {
        filename: 'huge.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(413);
    expect(cloudinaryRecorder.uploads).toEqual([]);
  });
});

describe('smoke endpoints', () => {
  it('exposes a health check', async () => {
    const response = await api().get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const response = await api().get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Route not found: GET /api/does-not-exist');
  });

  it('sets security headers', async () => {
    const response = await api().get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('exposes the root welcome message', async () => {
    const response = await api().get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Welcome to the API' });
  });
});

describe('request body errors', () => {
  it('answers 400 for malformed JSON instead of 500', async () => {
    const response = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com",');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid JSON body' });
  });

  it('answers 413 for a body over the JSON limit', async () => {
    const response = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(200 * 1024) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ message: 'Request body too large' });
  });
});
