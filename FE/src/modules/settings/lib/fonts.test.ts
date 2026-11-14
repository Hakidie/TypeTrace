import { afterEach, describe, expect, it, vi } from 'vitest';
import { appFonts } from '@/shared/lib/app-font';
import { applyFont, FONT_OPTIONS, readStoredFont, storeFont } from './fonts';

const option = (id: string) => FONT_OPTIONS.find((item) => item.id === id)!;

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty('--app-font');
  localStorage.clear();
});

describe('FONT_OPTIONS', () => {
  it('lists the fonts of appFonts in order, each with a label and a stack ending in a generic family', () => {
    expect(FONT_OPTIONS.map((item) => item.id)).toEqual([...appFonts]);
    for (const item of FONT_OPTIONS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.stack).toMatch(/(sans-serif|serif|monospace)$/);
    }
  });
});

describe('applyFont', () => {
  it('sets --app-font at once, before the font file has loaded', () => {
    vi.spyOn(option('lexend'), 'load').mockReturnValue(new Promise(() => undefined));

    void applyFont('lexend');

    expect(document.documentElement.style.getPropertyValue('--app-font')).toBe(option('lexend').stack);
  });

  it('keeps the stack when the font file fails to load', async () => {
    vi.spyOn(option('noto-serif'), 'load').mockRejectedValue(new Error('offline'));

    await expect(applyFont('noto-serif')).resolves.toBeUndefined();

    expect(document.documentElement.style.getPropertyValue('--app-font')).toBe(option('noto-serif').stack);
  });
});

describe('the stored font', () => {
  it('is read back after it was stored', () => {
    storeFont('lexend');

    expect(readStoredFont()).toBe('lexend');
  });

  it('is null when nothing was stored or the value is unknown', () => {
    expect(readStoredFont()).toBeNull();
    localStorage.setItem('typetrace-font', 'comic-sans');

    expect(readStoredFont()).toBeNull();
  });

  it('is null, and storing does not throw, when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readStoredFont()).toBeNull();
    expect(() => storeFont('lexend')).not.toThrow();
  });
});
