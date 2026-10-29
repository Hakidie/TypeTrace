import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../types/avatar.types';
import { layerFiles } from './layers';

describe('layerFiles', () => {
  it('stacks the default look in layer order', () => {
    expect(layerFiles(DEFAULT_AVATAR, 'idle')).toEqual([
      'bottom/navy.png',
      'shoes/sneakers-brown.png',
      'top/red-down.png',
      'body/peach-idle.png',
      'hair/short-brown.png',
    ]);
  });

  // Long hair falls in front of the shoulders (SpriteCook's drawing), so no hair item has a back layer now.
  it('adds the cute face, raised arms and the pose props, and no back hair for long hair', () => {
    const files = layerFiles({ ...DEFAULT_AVATAR, face: 'cute', hair: 'long-pink', headwear: 'crown', back: 'angel-wings' }, 'win');

    expect(files).toEqual([
      'back/angel-wings.png',
      'bottom/navy.png',
      'shoes/sneakers-brown.png',
      'top/red-up.png',
      'body/peach-cute-win.png',
      'hair/long-pink.png',
      'headwear/crown.png',
      'fx/win.png',
    ]);
  });

  it('keeps the trousers under a dress', () => {
    const files = layerFiles({ ...DEFAULT_AVATAR, top: 'dress-sailor-navy', bottom: 'tights-white' }, 'typing');

    expect(files).toContain('bottom/tights-white.png');
    expect(files).toContain('top/dress-sailor-navy-down.png');
    expect(files.at(-1)).toBe('fx/typing.png');
  });
});
