import { describe, expect, it } from 'vitest';
import { THEME_LIST } from '../../src/data/themes';
import { ThemeModel } from '../../src/models/theme.model';
import { seedThemes } from '../../src/services/theme-seed.service';

const midnight = { background: '#0b1020', text: '#e6ebff', muted: '#8f9bc9', accent: '#6d8bff' };
const sample = { name: 'Midnight', colors: midnight };

describe('seedThemes', () => {
  it('adds published themes owned by TypeTrace, dark or light by their background', async () => {
    const result = await seedThemes([sample, { name: 'Paper', colors: { ...midnight, background: '#fbf8f1', text: '#26231f', muted: '#6b655a', accent: '#1f6f78' } }]);

    expect(result).toEqual({ added: 2, skipped: 0 });
    expect(await ThemeModel.findOne({ name: 'Midnight' })).toMatchObject({ published: true, ownerName: 'TypeTrace', isDark: true });
    expect(await ThemeModel.findOne({ name: 'Paper' })).toMatchObject({ published: true, isDark: false });
    expect((await ThemeModel.findOne({ name: 'Midnight' }))!.owner).toBeUndefined();
  });

  it('can run many times without creating duplicates', async () => {
    await seedThemes([sample]);
    const second = await seedThemes([sample, { ...sample, name: 'Forest' }]);

    expect(second).toEqual({ added: 1, skipped: 1 });
    expect(await ThemeModel.countDocuments()).toBe(2);
  });

  it('does not overwrite a theme that was edited', async () => {
    await seedThemes([sample]);
    await ThemeModel.updateOne({ name: 'Midnight' }, { 'colors.accent': '#ff0000' });

    await seedThemes([sample]);

    expect((await ThemeModel.findOne({ name: 'Midnight' }))!.colors.accent).toBe('#ff0000');
  });

  it('refuses a theme that is hard to read and adds nothing', async () => {
    const unreadable = { name: 'Murky', colors: { ...midnight, text: '#222a44' } };

    await expect(seedThemes([sample, unreadable])).rejects.toThrow(/Murky.*Text is hard to read/);

    expect(await ThemeModel.countDocuments()).toBe(0);
  });

  it('imports the starter themes twice without duplicates', async () => {
    const first = await seedThemes(THEME_LIST);
    const second = await seedThemes(THEME_LIST);

    expect(first.added).toBe(THEME_LIST.length);
    expect(second).toEqual({ added: 0, skipped: THEME_LIST.length });
  });
});
