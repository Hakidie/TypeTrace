import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from '../types/avatar.types';
import { layerFiles } from './layers';
import { preloadAvatar } from './preload';

describe('preloadAvatar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads each file of every pose once', () => {
    const loaded: string[] = [];
    vi.stubGlobal(
      'Image',
      class {
        set src(value: string) {
          loaded.push(value);
        }
      },
    );

    preloadAvatar(DEFAULT_AVATAR);

    const expected = new Set(
      (['idle', 'typing', 'win', 'lose'] as const).flatMap((pose) => layerFiles(DEFAULT_AVATAR, pose).map((file) => `/avatar/${file}`)),
    );
    expect(new Set(loaded)).toEqual(expected);
    expect(loaded).toHaveLength(expected.size);
    expect(loaded).toContain('/avatar/fx/lose.png');
    expect(loaded).toContain('/avatar/body/peach-lose.png');
  });
});
