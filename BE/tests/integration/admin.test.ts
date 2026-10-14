import { describe, expect, it } from 'vitest';
import { NoteModel } from '../../src/models/note.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { cloudinaryRecorder } from '../helpers/cloudinary-recorder';
import { bearerFor, createUser } from '../helpers/user-factory';

const SECRET_FIELDS = ['password', 'otpCode', 'otpExpiresAt', 'resetToken', 'resetTokenExpiresAt'];

const signInAdmin = async () => {
  const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' });
  return { admin, auth: bearerFor(admin) };
};

describe('admin access', () => {
  it('is open to admins only: other accounts get 403 and anonymous visitors 401', async () => {
    const user = await createUser({ email: 'plain@example.com' });
    const { auth } = await signInAdmin();
    expect((await api().get('/api/admin/users').set('Authorization', bearerFor(user))).status).toBe(403);
    expect((await api().get('/api/admin/stats').set('Authorization', bearerFor(user))).status).toBe(403);
    expect((await api().delete(`/api/admin/users/${user._id}`).set('Authorization', bearerFor(user))).status).toBe(403);
    expect((await api().get('/api/admin/users')).status).toBe(401);
    expect((await api().get('/api/admin/users').set('Authorization', auth)).status).toBe(200);
  });

  it('still protects the signed-in account from deleting or demoting itself', async () => {
    const user = await createUser({ role: 'admin' });
    const auth = bearerFor(user);
    expect((await api().delete(`/api/admin/users/${user._id}`).set('Authorization', auth)).status).toBe(400);
    expect((await api().patch(`/api/admin/users/${user._id}`).set('Authorization', auth).send({ role: 'user' })).status).toBe(403);
  });
});

describe('GET /api/admin/stats', () => {
  it('counts users, admins, verified users, new users and notes', async () => {
    const { auth } = await signInAdmin();
    const user = await createUser({ email: 'u@example.com', isEmailVerified: false });
    await NoteModel.create({ title: 'n', owner: user._id });

    const response = await api().get('/api/admin/stats').set('Authorization', auth);

    expect(response.body).toEqual({ users: 2, admins: 1, verified: 1, newUsersThisWeek: 2, notes: 1 });
  });
});

describe('GET /api/admin/users', () => {
  it('lists users without private fields', async () => {
    const { auth } = await signInAdmin();
    await createUser({ email: 'lan@example.com' });

    const response = await api().get('/api/admin/users').set('Authorization', auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2, page: 1 });
    for (const user of response.body.items) {
      for (const field of SECRET_FIELDS) expect(user).not.toHaveProperty(field);
    }
  });

  it('searches email and display name, filters by role and verified, and sorts', async () => {
    const { auth } = await signInAdmin();
    await createUser({ email: 'lan@example.com', displayName: 'Nguyen Lan' });
    await createUser({ email: 'minh@example.com', displayName: 'Tran Minh', isEmailVerified: false });

    const get = (query: string) => api().get(`/api/admin/users?${query}`).set('Authorization', auth);
    const emails = (body: { items: { email: string }[] }) => body.items.map((user) => user.email);

    expect(emails((await get('q=LAN')).body)).toEqual(['lan@example.com']);
    expect(emails((await get('q=tran')).body)).toEqual(['minh@example.com']);
    expect(emails((await get('role=admin')).body)).toEqual(['admin@example.com']);
    expect(emails((await get('verified=false')).body)).toEqual(['minh@example.com']);
    expect(emails((await get('sort=email')).body)).toEqual(['admin@example.com', 'lan@example.com', 'minh@example.com']);
    expect((await get('sort=password')).status).toBe(400);
    expect((await get('role=superadmin')).status).toBe(400);
  });
});

describe('PATCH /api/admin/users/:id', () => {
  it('updates role, verification, login OTP and display name', async () => {
    const { auth } = await signInAdmin();
    const user = await createUser({ email: 'lan@example.com', isEmailVerified: false });

    const response = await api()
      .patch(`/api/admin/users/${user._id}`)
      .set('Authorization', auth)
      .send({ role: 'admin', isEmailVerified: true, loginOtpEnabled: true, displayName: 'Lan' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ role: 'admin', isEmailVerified: true, loginOtpEnabled: true, displayName: 'Lan' });
  });

  it('ignores fields admins may not change, such as email and password', async () => {
    const { auth } = await signInAdmin();
    const user = await createUser({ email: 'lan@example.com' });

    await api()
      .patch(`/api/admin/users/${user._id}`)
      .set('Authorization', auth)
      .send({ displayName: 'Lan', email: 'hacked@example.com', password: 'x' });

    const stored = await UserModel.findById(user._id);
    expect(stored?.email).toBe('lan@example.com');
    expect(stored?.password).toBe(user.password);
  });

  it('does not let an admin remove their own admin role', async () => {
    const { admin, auth } = await signInAdmin();

    const response = await api().patch(`/api/admin/users/${admin._id}`).set('Authorization', auth).send({ role: 'user' });

    expect(response.status).toBe(403);
    expect((await UserModel.findById(admin._id))?.role).toBe('admin');
  });

  it('answers 404 for an unknown user and 400 for an empty update', async () => {
    const { auth } = await signInAdmin();
    const missing = '0123456789abcdef01234567';
    expect((await api().patch(`/api/admin/users/${missing}`).set('Authorization', auth).send({ role: 'user' })).status).toBe(404);
    const user = await createUser({ email: 'lan@example.com' });
    expect((await api().patch(`/api/admin/users/${user._id}`).set('Authorization', auth).send({})).status).toBe(400);
  });
});

describe('deleting users', () => {
  it('deletes a user together with their notes, typing sessions and avatar', async () => {
    const { auth } = await signInAdmin();
    const user = await createUser({ email: 'lan@example.com' });
    await UserModel.updateOne({ _id: user._id }, { avatarPublicId: 'avatars/lan' });
    await NoteModel.create({ title: 'n', owner: user._id });
    await TypingSessionModel.create({ owner: user._id, passageId: 'basic-1', targetWords: ['a'] });

    const response = await api().delete(`/api/admin/users/${user._id}`).set('Authorization', auth);

    expect(response.status).toBe(204);
    expect(await UserModel.exists({ _id: user._id })).toBeNull();
    expect(await NoteModel.countDocuments()).toBe(0);
    expect(await TypingSessionModel.countDocuments()).toBe(0);
    expect(cloudinaryRecorder.destroyed).toEqual(['avatars/lan']);
  });

  it('bulk deletes the selected users', async () => {
    const { auth } = await signInAdmin();
    const a = await createUser({ email: 'a@example.com' });
    const b = await createUser({ email: 'b@example.com' });
    await createUser({ email: 'keep@example.com' });

    const response = await api()
      .post('/api/admin/users/bulk-delete')
      .set('Authorization', auth)
      .send({ ids: [String(a._id), String(b._id)] });

    expect(response.body).toEqual({ deleted: 2 });
    expect(await UserModel.countDocuments()).toBe(2);
  });

  it('never deletes the signed-in admin', async () => {
    const { admin, auth } = await signInAdmin();
    const other = await createUser({ email: 'a@example.com' });

    expect((await api().delete(`/api/admin/users/${admin._id}`).set('Authorization', auth)).status).toBe(400);
    const bulk = await api()
      .post('/api/admin/users/bulk-delete')
      .set('Authorization', auth)
      .send({ ids: [String(other._id), String(admin._id)] });
    expect(bulk.status).toBe(400);
    expect(await UserModel.countDocuments()).toBe(2);
  });

  it('answers 404 for an unknown user and validates bulk ids', async () => {
    const { auth } = await signInAdmin();
    expect((await api().delete('/api/admin/users/0123456789abcdef01234567').set('Authorization', auth)).status).toBe(404);
    expect((await api().post('/api/admin/users/bulk-delete').set('Authorization', auth).send({ ids: [] })).status).toBe(400);
    expect((await api().post('/api/admin/users/bulk-delete').set('Authorization', auth).send({ ids: ['x'] })).status).toBe(400);
  });
});
