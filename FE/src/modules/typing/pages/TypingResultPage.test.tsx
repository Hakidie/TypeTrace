import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { TypingResultPage } from './TypingResultPage';

const get = vi.fn();

vi.mock('../api/typing.api', () => ({ typingApi: { get: (id: string) => get(id) } }));

const counts = (overrides: Record<string, number> = {}) => ({
  BASE_LETTER: 0,
  D_MISSING: 0,
  MARK_WRONG: 0,
  TONE_WRONG: 0,
  HOI_NGA_CONFUSION: 0,
  ...overrides,
});

const completed = {
  _id: 's1',
  status: 'completed',
  targetWords: ['Tiếng', 'Việt'],
  words: [
    { index: 0, target: 'Tiếng', typed: 'Tiếng', errorTypes: [] },
    { index: 1, target: 'Việt', typed: 'Viet', errorTypes: ['MARK_WRONG', 'TONE_WRONG'] },
  ],
  wpm: 12.5,
  accuracy: 50,
  durationMs: 65000,
  errorCounts: counts({ MARK_WRONG: 1, TONE_WRONG: 1 }),
  opportunityCounts: counts({ BASE_LETTER: 2, TONE_WRONG: 2, MARK_WRONG: 2 }),
  isCounted: false,
};

const renderPage = () =>
  renderWithProviders(<TypingResultPage />, { route: '/typing/result/s1', path: '/typing/result/:id' });

beforeEach(() => get.mockReset());

describe('TypingResultPage', () => {
  it('shows WPM, accuracy, time and the mistakes with their error types', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    expect(await screen.findByText('12.5')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('Viet', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('Wrong vowel mark (â ê ô ă ơ ư), Wrong tone', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('Wrong tone')).toBeInTheDocument();
    expect(screen.getAllByText('1 / 2 (50%)', { exact: false })).toHaveLength(2); // mark and tone
  });

  it('shows the passage with the wrong words highlighted, like while typing', async () => {
    get.mockResolvedValue(completed);
    renderPage();
    await screen.findByText('12.5');

    const passage = screen.getByLabelText('Passage to type');
    const [right, wrong] = Array.from(passage.children);
    expect(right.className).toContain('text-foreground');
    expect(right).toHaveTextContent('Tiếng');
    expect(wrong).toHaveTextContent('Viet'); // what was typed
    expect(wrong).toHaveAttribute('title', 'Should be: Việt');
  });

  it('explains when the session is not counted', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    expect(await screen.findByText(/not counted in your error profile/)).toBeInTheDocument();
  });

  it('shows an error when the session cannot be loaded', async () => {
    get.mockRejectedValueOnce({ response: { status: 404, data: { message: 'Session not found' } } });
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('says so when the session has no result yet', async () => {
    get.mockResolvedValue({ ...completed, status: 'in_progress', errorCounts: undefined });
    renderPage();

    expect(await screen.findByText('This session has no result')).toBeInTheDocument();
  });
});
