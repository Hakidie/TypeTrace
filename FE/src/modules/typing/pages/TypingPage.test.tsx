import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Link } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { TypingPage } from './TypingPage';

const start = vi.fn();
const begin = vi.fn();
const complete = vi.fn();

vi.mock('../api/typing.api', () => ({
  typingApi: {
    start: (input: unknown) => start(input),
    begin: (id: string) => begin(id),
    complete: (id: string, typedWords: string[]) => complete(id, typedWords),
  },
}));

const session = {
  _id: 's1',
  mode: 'practice',
  status: 'in_progress',
  targetWords: ['Tiếng', 'Việt'],
  startedAt: new Date().toISOString(),
};

const renderPage = () =>
  renderWithProviders(<TypingPage />, { route: '/typing', otherRoutes: { '/typing/result/s1': 'result page' } });

beforeEach(() => {
  start.mockReset().mockResolvedValue(session);
  begin.mockReset().mockResolvedValue(session);
  complete.mockReset().mockResolvedValue({ ...session, status: 'completed' });
});

describe('TypingPage', () => {
  it('starts a session when the page opens and shows the passage, without a start button', async () => {
    renderPage();

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(screen.getByLabelText('Passage to type')).toHaveTextContent('Tiếng');
    expect(screen.queryByRole('button', { name: /start typing/i })).not.toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ mode: 'practice' });
  });

  it('types the placement passage when opened from the placement intro, also after Restart', async () => {
    const user = userEvent.setup();
    start.mockResolvedValue({ ...session, mode: 'placement' });
    renderWithProviders(<TypingPage />, { route: '/typing?mode=placement' });

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ mode: 'placement' });

    await user.click(screen.getByRole('button', { name: /restart/i }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith({ mode: 'placement' });
  });

  it('starts a practice session when the learner leaves the placement test for normal practice', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <Link to="/typing">Typing</Link>
        <TypingPage />
      </>,
      { route: '/typing?mode=placement' },
    );
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('link', { name: 'Typing' }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(start).toHaveBeenLastCalledWith({ mode: 'practice' });
  });

  it('tells the server about the first key only once the learner types', async () => {
    const user = userEvent.setup();
    renderPage();
    const area = await screen.findByRole('textbox', { name: 'Typing area' });
    expect(begin).not.toHaveBeenCalled();

    await user.type(area, 'Ti');

    await waitFor(() => expect(begin).toHaveBeenCalledTimes(1));
    expect(begin).toHaveBeenCalledWith('s1');
  });

  it('shows an error with a retry when the session cannot be started', async () => {
    const user = userEvent.setup();
    start.mockRejectedValueOnce(new Error('down'));
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again|retry/i }));

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
  });

  it('sends only the typed words when finished, then opens the result', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByRole('textbox', { name: 'Typing area' }), 'Tiếng Viet ');

    await waitFor(() => expect(complete).toHaveBeenCalledWith('s1', ['Tiếng', 'Viet']));
    expect(await screen.findByText('result page')).toBeInTheDocument();
  });

  it('starts a new session on Restart', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox');

    await user.click(screen.getByRole('button', { name: /restart/i }));

    await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
  });

  it('has Practice, Placement and Rank tabs and shows the name of the passage', async () => {
    start.mockResolvedValue({ ...session, passageTitle: 'Mùa thu Hà Nội' });
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    expect(within(screen.getByRole('radiogroup', { name: 'Mode' })).getAllByRole('radio').map((tab) => tab.textContent)).toEqual(['Practice', 'Placement', 'Rank']);
    expect(screen.getByRole('radio', { name: 'Practice' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Rank' })).toBeDisabled();
    expect(screen.getByText('Mùa thu Hà Nội')).toBeInTheDocument();
  });

  it('starts a placement session when the Placement tab is picked', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    await user.click(screen.getByRole('radio', { name: 'Placement' }));

    await waitFor(() => expect(start).toHaveBeenLastCalledWith({ mode: 'placement' }));
    expect(screen.getByRole('radio', { name: 'Placement' })).toHaveAttribute('aria-checked', 'true');
  });

  it('has 1m, 2m and 3m time tabs on the right of the passage name, 3m selected', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('textbox', { name: 'Typing area' });

    const time = screen.getByRole('radiogroup', { name: 'Time' });
    expect(within(time).getAllByRole('radio').map((tab) => tab.textContent)).toEqual(['1m', '2m', '3m']);
    expect(within(time).getByRole('radio', { name: '3m' })).toHaveAttribute('aria-checked', 'true');

    await user.click(within(time).getByRole('radio', { name: '1m' }));

    expect(within(time).getByRole('radio', { name: '1m' })).toHaveAttribute('aria-checked', 'true');
  });
});
