import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { TypingResultPage } from './TypingResultPage';

const get = vi.fn();
const stats = vi.fn();

vi.mock('../api/typing.api', () => ({ typingApi: { get: (id: string) => get(id), stats: (id: string) => stats(id) } }));

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
  mode: 'practice',
  passageTitle: 'Tiếng Việt rất đẹp',
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

const openErrorDetail = async () => userEvent.click(await screen.findByRole('button', { name: 'Error detail' }));

const renderPage = () =>
  renderWithProviders(<TypingResultPage />, { route: '/typing/result/s1', path: '/typing/result/:id' });

const sessionStats = (overrides = {}) => ({
  totalWords: 2,
  correctWords: 1,
  wrongWords: 1,
  wrongRate: 50,
  errorTypes: [{ type: 'TONE_WRONG', errors: 1, opportunities: 2, rate: 50 }],
  isCounted: false,
  timeLimitSeconds: 30,
  timeline: { status: 'ok', points: [{ second: 5, wpm: 12, errors: 1 }] },
  ...overrides,
});

beforeEach(() => {
  get.mockReset();
  stats.mockReset();
  stats.mockResolvedValue(sessionStats());
});

describe('TypingResultPage', () => {
  it('shows the final WPM and accuracy and, once asked, the mistakes with their error types', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    expect(await screen.findByText('12.5')).toBeInTheDocument(); // next to the chart
    expect(screen.getByText('50%')).toBeInTheDocument();
    await openErrorDetail();
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
    // Since SCRUM-31 a counted session is also what the streak and the daily mission need.
    expect(screen.getByText(/not counted in your error profile, streak or daily mission/)).toBeInTheDocument();
  });

  it('hides the not-counted note with the OK button', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    await screen.findByText(/not counted in your error profile/);
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(screen.queryByText(/not counted in your error profile/)).not.toBeInTheDocument();
  });

  it('shows no note, and no OK button, for a session that is counted', async () => {
    get.mockResolvedValue({ ...completed, isCounted: true });
    renderPage();

    await screen.findByRole('button', { name: 'Error detail' });
    expect(screen.queryByText(/not counted in your error profile/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
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

  it('draws the error chart from the stats once Error detail is pressed', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    await openErrorDetail();
    expect(screen.getByRole('img', { name: 'Biểu đồ tỉ lệ lỗi theo loại' })).toBeInTheDocument();
    expect(screen.queryByText('Từ đúng')).not.toBeInTheDocument(); // the right/wrong cards are gone
  });

  it('says so instead of drawing an empty chart when the session has no mistakes', async () => {
    get.mockResolvedValue(completed);
    stats.mockResolvedValue(sessionStats({ correctWords: 2, wrongWords: 0, wrongRate: 0, errorTypes: [] }));
    renderPage();

    await openErrorDetail();
    expect(await screen.findByText('Phiên này không có lỗi nào')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Biểu đồ tỉ lệ lỗi theo loại' })).not.toBeInTheDocument();
  });

  it('shows an error with a retry when the stats cannot be loaded, and keeps the rest of the result', async () => {
    get.mockResolvedValue(completed);
    stats.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Passage to type')).toBeInTheDocument();
  });

  it('draws the speed and error chart, or tells why it cannot', async () => {
    get.mockResolvedValue(completed);
    renderPage();
    expect(await screen.findByRole('img', { name: 'Biểu đồ WPM theo thời gian, có dấu ở giây gõ sai' })).toBeInTheDocument();
  });

  it('says an older session has no time data, and that a short one is too short', async () => {
    get.mockResolvedValue(completed);
    stats.mockResolvedValue(sessionStats({ timeline: { status: 'no_data', points: [] } }));
    const first = renderPage();
    expect(await screen.findByText('Phiên này không có dữ liệu thời gian')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Biểu đồ WPM theo thời gian, có dấu ở giây gõ sai' })).not.toBeInTheDocument();
    first.unmount();

    stats.mockResolvedValue(sessionStats({ timeline: { status: 'too_short', points: [] } }));
    renderPage();
    expect(await screen.findByText('Phiên quá ngắn để vẽ biểu đồ')).toBeInTheDocument();
  });

  it('shows the final WPM and ACC stacked next to the speed chart', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    const chart = (await screen.findByRole('img', { name: 'Biểu đồ WPM theo thời gian, có dấu ở giây gõ sai' })).closest('div.flex')!;
    const list = chart.querySelector('dl')!;
    expect(list).toHaveTextContent('WPM12.5');
    expect(list).toHaveTextContent('ACC50%');
  });

  it('shows the passage name, the typing mode and the time chosen under the speed chart', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    expect(await screen.findByText('Tiếng Việt rất đẹp')).toBeInTheDocument();
    expect(screen.getByText('Practice')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument(); // timeLimitSeconds of the stats
  });

  it('shows a dash for a session saved before the passage name was stored, and the placement mode', async () => {
    get.mockResolvedValue({ ...completed, passageTitle: undefined, mode: 'placement' });
    stats.mockResolvedValue(sessionStats({ timeLimitSeconds: 120 }));
    renderPage();

    expect(await screen.findByText('Placement')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('2m')).toBeInTheDocument();
  });

  it('hides the error panels until Error detail is pressed, and hides them again on a second press', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    const button = await screen.findByRole('button', { name: 'Error detail' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Lỗi theo loại')).not.toBeInTheDocument();
    expect(screen.queryByText('Mistakes')).not.toBeInTheDocument();
    expect(screen.queryByText('Error rate by type')).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Lỗi theo loại')).toBeInTheDocument();
    expect(screen.getByText('Mistakes')).toBeInTheDocument();
    expect(screen.getByText('Error rate by type')).toBeInTheDocument();

    await userEvent.click(button);
    expect(screen.queryByText('Mistakes')).not.toBeInTheDocument();
  });

  it('has a Replay button (not working yet) and a Type again link to the Typing page', async () => {
    get.mockResolvedValue(completed);
    renderPage();

    expect(await screen.findByRole('button', { name: 'Replay' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Type again' })).toHaveAttribute('href', '/typing');
  });
});
