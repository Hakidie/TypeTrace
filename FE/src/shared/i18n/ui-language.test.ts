import { describe, expect, it } from 'vitest';
import { i18n } from './i18n';
import { initialUiLanguage, languageOfBrowser, readStoredUiLanguage, storeUiLanguage, UI_LANGUAGE_KEY } from './ui-language';

describe('languageOfBrowser', () => {
  it.each([
    ['vi', 'vi'],
    ['vi-VN', 'vi'],
    ['VI', 'vi'],
    ['en-US', 'en'],
    ['fr', 'en'],
    [undefined, 'en'],
  ])('%s gives %s', (browser, expected) => {
    expect(languageOfBrowser(browser)).toBe(expected);
  });
});

describe('the language kept in the browser', () => {
  it('is none until chosen, and then wins over the browser language', () => {
    expect(readStoredUiLanguage()).toBeNull();
    storeUiLanguage('vi');
    expect(readStoredUiLanguage()).toBe('vi');
    expect(initialUiLanguage()).toBe('vi');
  });

  it('ignores a value that is not a language', () => {
    window.localStorage.setItem(UI_LANGUAGE_KEY, 'fr');
    expect(readStoredUiLanguage()).toBeNull();
  });
});

describe('i18n', () => {
  it('sets the lang of <html> with the language and falls back to English for a missing string', async () => {
    await i18n.changeLanguage('vi');
    expect(document.documentElement.lang).toBe('vi');
    expect(i18n.t('settings:language.title')).toBe('Ngôn ngữ');

    i18n.addResource('en', 'common', 'onlyEnglish', 'Only English');
    expect(i18n.t('onlyEnglish')).toBe('Only English');

    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
