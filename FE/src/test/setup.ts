import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetMinigameLang } from '@/shared/hooks/use-minigame-lang';

/**
 * Shared jsdom setup: unmounts React trees, clears browser storage and provides
 * the browser APIs jsdom lacks: `matchMedia` (theme helpers) and `ResizeObserver`
 * (Radix Switch inside a form).
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
}

beforeEach(() => {
  window.localStorage.clear();
  resetMinigameLang();

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  }
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetMinigameLang();
});
