import { Fragment, act, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { GuestTypingPage } from './GuestTypingPage';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/shared/api/http', () => ({ http }));

vi.mock('@/modules/home/lib/guest-passages', async (importActual) => ({
  ...(await importActual<typeof import('@/modules/home/lib/guest-passages')>()),
  pickGuestPassage: (_not?: number, only?: number, language = 'vi') => ({
    index: only ?? 0,
    title: language === 'en' ? 'Morning run' : ['Buổi sáng', 'Thu Hà Nội'][only ?? 0],
    words: language === 'en' ? ['Hello', 'world'] : ['Tiếng', 'Việt'],
  }),
}));

/** As `AppLayout`: the page is drawn again when the language of the interface changes, which the language button does (SCRUM-319). */
const Redrawn = ({ children }: { children: ReactNode }) => {
  const { i18n: instance } = useTranslation();
  return <Fragment key={instance.language}>{children}</Fragment>;
};

const renderPage = (route = '/typing') =>
  renderWithProviders(<GuestTypingPage />, { route, otherRoutes: { '/login': 'login page' } });

const noApiCalls = () => Object.values(http).forEach((fn) => expect(fn).not.toHaveBeenCalled());

beforeEach(() => Object.values(http).forEach((fn) => fn.mockReset()));

describe('GuestTypingPage', () => {
  it('shows all the mode tabs, Practice selected, and a fixed passage with the time choices (no passage menu)', () => {
    renderPage();

    const modes = screen.getByRole('radiogroup', { name: 'Mode' });
    expect(modes).toHaveTextContent('Practice');
    expect(modes).toHaveTextContent('Placement');
    expect(modes).toHaveTextContent('Rank');
    expect(modes).toHaveTextContent('Minigames');
    expect(screen.getByRole('radio', { name: 'Practice' })).toBeChecked();
    expect(screen.getByLabelText('Passage to type')).toHaveTextContent('Tiếng');
    expect(screen.getByRole('radio', { name: '20' })).toBeChecked();
    // Random shows the name of the passage above the text, as the signed-in page does.
    expect(screen.getByText('Buổi sáng')).toBeInTheDocument();
  });

  it('shows the passage tabs Manual, Random and Train, Random selected; Train is locked and leads to the login page', async () => {
    const user = userEvent.setup();
    renderPage();

    const tabs = screen.getByRole('radiogroup', { name: 'Passage' });
    // Only the selected tab keeps its word; the others are their icon (the name stays for screen readers).
    expect(screen.getByRole('radio', { name: 'Random' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Random' })).toHaveTextContent('Random');
    expect(screen.getByRole('radio', { name: 'Manual' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Train' }).querySelector('svg')).not.toBeNull();
    expect(tabs.querySelectorAll('.sr-only')).toHaveLength(2);

    await user.click(screen.getByRole('radio', { name: 'Train' }));
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('lets the guest choose one of the fixed passages with Manual, and never calls the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Manual' }));
    expect(screen.getByRole('radio', { name: 'Manual' })).toBeChecked();
    // The menu of the signed-in page: a search box, Sort, and the passages with the System tag and their words.
    expect(await screen.findByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort: Newest' })).toBeInTheDocument();
    expect(screen.getAllByText('System').length).toBeGreaterThan(0);
    await user.click(await screen.findByRole('menuitemradio', { name: /Thu Hà Nội/ }));

    expect(screen.getByRole('button', { name: 'Choose passage' })).toHaveTextContent('Thu Hà Nội');
    noApiCalls();
  });

  it('sends the guest to the login page from the tabs that need an account', async () => {
    const user = userEvent.setup();
    renderPage();

    // The tabs that need an account are dimmed, the others are not.
    for (const name of ['Placement', 'Rank', 'Train']) expect(screen.getByRole('radio', { name })).toHaveClass('opacity-50');
    for (const name of ['Practice', 'Minigames', 'Manual', 'Random']) expect(screen.getByRole('radio', { name })).not.toHaveClass('opacity-50');

    await user.click(screen.getByRole('radio', { name: 'Placement' }));

    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('sends the guest to the login page from Rank too', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Rank' }));

    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('shows the result with the invitation to register when the passage is finished, and never calls the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox', { name: 'Typing area' }), 'Tiếng Việt ');

    expect(await screen.findByText('Keep your results')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    noApiCalls();
  });

  it('opens word rain from Minigames with the fixed words and the time tabs, and never calls the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Minigames' }));

    expect(await screen.findByRole('heading', { name: 'Word rain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(screen.getByRole('radiogroup', { name: 'Time' })).toBeInTheDocument();
    // The clock shows the time picked: 20 seconds.
    expect(screen.getByLabelText('Time left')).toHaveTextContent('0:20');

    await user.click(screen.getByRole('radio', { name: '30' }));
    expect(screen.getByLabelText('Time left')).toHaveTextContent('0:30');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByLabelText('Type a falling word')).toBeInTheDocument();
    noApiCalls();
  });

  it('switches the typing language like the signed-in page: a new passage in English, every tab kept, and back', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole('radio', { name: 'Placement' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Typing language: Vietnamese. Switch to English' }));

    expect(screen.getByLabelText('Passage to type')).toHaveTextContent('Hello');
    expect(screen.getByText('Morning run')).toBeInTheDocument();
    // The placement test has one test per language (SCRUM-305): its tab (locked for a guest) stays in English.
    expect(screen.getByRole('radio', { name: 'Placement' })).toBeInTheDocument();

    // Back to Vietnamese: the interface follows the button (SCRUM-319), kept in this browser as a guest's choice is.
    await user.click(screen.getByRole('button', { name: 'Typing language: English. Switch to Vietnamese' }));
    expect(await screen.findByLabelText('Đoạn văn cần gõ')).toHaveTextContent('Tiếng');
    expect(i18n.language).toBe('vi');
    expect(localStorage.getItem('typetrace.uiLanguage')).toBe('vi');
    expect(screen.getByRole('radio', { name: 'Kiểm tra' })).toBeInTheDocument();
    noApiCalls();
  });

  it('keeps the English the guest chose when the page is drawn again in the English interface', async () => {
    const user = userEvent.setup();
    await act(() => i18n.changeLanguage('vi'));
    renderWithProviders(
      <Redrawn>
        <GuestTypingPage />
      </Redrawn>,
      { route: '/typing' },
    );

    await user.click(screen.getByRole('button', { name: 'Ngôn ngữ gõ: Tiếng Việt. Chuyển sang Tiếng Anh' }));

    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(await screen.findByRole('button', { name: 'Typing language: English. Switch to Vietnamese' })).toBeInTheDocument();
    expect(screen.getByLabelText('Passage to type')).toHaveTextContent('Hello');
    noApiCalls();
  });

  it('grades an English passage with the English error set, and shows no language button in Minigames', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Switch to English/ }));

    await user.type(screen.getByRole('textbox', { name: 'Typing area' }), 'Hello wrold ');

    expect(await screen.findByText('Keep your results')).toBeInTheDocument();
    expect(screen.getByText('wrold')).toBeInTheDocument();
  });

  it('has no language button in Minigames', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('radio', { name: 'Minigames' }));
    expect(screen.queryByRole('button', { name: /Typing language/ })).not.toBeInTheDocument();
  });
});
