import { describe, expect, it } from 'vitest';
import { shownPictureUrl } from './avatar-picture';

describe('shownPictureUrl', () => {
  it('is the uploaded picture, unless the account chose its pixel avatar', () => {
    expect(shownPictureUrl({ avatarUrl: 'https://img/me.png' })).toBe('https://img/me.png');
    expect(shownPictureUrl({ avatarUrl: 'https://img/me.png', avatarSource: 'picture' })).toBe('https://img/me.png');
    expect(shownPictureUrl({ avatarUrl: 'https://img/me.png', avatarSource: 'pixel' })).toBeUndefined();
  });

  it('is nothing without a picture or a user', () => {
    expect(shownPictureUrl({})).toBeUndefined();
    expect(shownPictureUrl(undefined)).toBeUndefined();
  });
});
