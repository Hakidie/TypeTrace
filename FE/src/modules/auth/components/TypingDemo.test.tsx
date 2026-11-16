import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { TypingDemo } from './TypingDemo';

const SENTENCE = 'Mỗi lỗi gõ sai đều để lại một dấu vết nhỏ trên đường học gõ nhanh hơn.';

// Each frame schedules the next one after React renders it, so the clock moves in small steps, one render apiece.
const advance = (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 25) {
    act(() => {
      vi.advanceTimersByTime(25);
    });
  }
};

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

describe('TypingDemo', () => {
  // The tests of the animation read the Vietnamese passage; the last two pick their language themselves.
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('vi'));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives screen readers the whole passage from the start', () => {
    setReducedMotion(false);
    render(<TypingDemo />);

    expect(screen.getByText(SENTENCE, { selector: '.sr-only' })).toBeInTheDocument();
  });

  it('starts with a caret on the first word and nothing typed', () => {
    setReducedMotion(false);
    const { container } = render(<TypingDemo />);

    expect(container.querySelector('.bg-destructive\\/15')).not.toBeNull();
    expect(container.querySelector('.underline')).toBeNull();
  });

  it('finishes one word wrong and ends with the caret gone', () => {
    setReducedMotion(false);
    const { container } = render(<TypingDemo />);

    advance(15000);

    const wrong = container.querySelectorAll('.underline');
    expect(wrong).toHaveLength(1);
    expect(wrong[0].textContent).toBe('sau');
    expect(container.querySelector('.bg-destructive\\/15')).toBeNull();
  });

  it('shows the final state at once for reduced motion', () => {
    setReducedMotion(true);
    const { container } = render(<TypingDemo />);

    expect(container.querySelectorAll('.underline')).toHaveLength(1);
    expect(container.querySelector('.bg-destructive\\/15')).toBeNull();
  });

  it('types an English passage when the interface is in English, and Vietnamese when it is in Vietnamese', async () => {
    setReducedMotion(true);
    await act(() => i18n.changeLanguage('en'));
    const english = render(<TypingDemo />);
    expect(english.container.querySelector('.sr-only')).toHaveTextContent('Every typing mistake leaves a small trace on the way to typing faster.');
    english.unmount();

    await act(() => i18n.changeLanguage('vi'));
    const vietnamese = render(<TypingDemo />);
    expect(vietnamese.container.querySelector('.sr-only')).toHaveTextContent(SENTENCE);
  });

  it('starts again with the other passage when the language changes', async () => {
    setReducedMotion(true);
    await act(() => i18n.changeLanguage('en'));
    const { container } = render(<TypingDemo />);
    expect(container.querySelector('.sr-only')).toHaveTextContent('Every typing');

    await act(() => i18n.changeLanguage('vi'));

    expect(container.querySelector('.sr-only')).toHaveTextContent('Mỗi lỗi');
  });
});
