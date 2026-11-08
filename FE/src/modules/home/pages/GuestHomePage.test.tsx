import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { GuestHomePage } from './GuestHomePage';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/shared/api/http', () => ({ http }));

let next = 0;
vi.mock('../lib/guest-passages', async (importActual) => ({
  ...(await importActual<typeof import('../lib/guest-passages')>()),
  // Two short passages, so a test can finish one and see that "Try again" brings the other.
  pickGuestPassage: () => {
    const passages = [['Tiếng', 'Việt'], ['Hà', 'Nội']];
    const index = next++ % passages.length;
    return { index, words: passages[index] };
  },
}));

const renderPage = () =>
  renderWithProviders(<GuestHomePage />, { route: '/', otherRoutes: { '/register': 'register page', '/login': 'login page' } });

beforeEach(() => {
  next = 0;
  Object.values(http).forEach((fn) => fn.mockReset());
});

describe('GuestHomePage', () => {
  it('shows the passage and the way to log in or register', () => {
    renderPage();

    expect(screen.getByLabelText('Passage to type')).toHaveTextContent('Tiếng');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  });

  it('shows the result with the mistakes when the passage is finished, and never calls the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox', { name: 'Typing area' }), 'Tiếng Viet ');

    expect(await screen.findByText('Keep your results')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument(); // one of two words right
    expect(screen.getByText('Viet')).toBeInTheDocument(); // in the list of mistakes
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    Object.values(http).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('starts another passage with Try again', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByRole('textbox', { name: 'Typing area' }), 'Tiếng Việt ');

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(screen.getByLabelText('Passage to type')).toHaveTextContent('Hà');
    expect(screen.queryByText('Keep your results')).not.toBeInTheDocument();
  });
});
