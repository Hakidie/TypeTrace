import userEvent from '@testing-library/user-event';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { createTestQueryClient, renderWithProviders } from '@/test/render-with-providers';
import { PassagesPage } from './PassagesPage';

const list = vi.fn();
const create = vi.fn();
const remove = vi.fn();
const requestPublic = vi.fn();
const withdrawRequest = vi.fn();

vi.mock('../api/learner-passages.api', () => ({
  learnerPassagesApi: {
    list: (params: unknown) => list(params),
    create: (input: unknown) => create(input),
    remove: (id: string) => remove(id),
    requestPublic: (id: string) => requestPublic(id),
    withdrawRequest: (id: string) => withdrawRequest(id),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const theirs = {
  _id: 'p1',
  title: 'Hà Nội vào thu',
  wordCount: 40,
  ownerName: 'TypeTrace',
  visibility: 'public',
  status: 'published',
  isOwn: false,
  createdAt: '2026-10-01T00:00:00.000Z',
};
const mine = {
  _id: 'p2',
  title: 'Bài của tôi',
  wordCount: 25,
  ownerName: 'Lan',
  visibility: 'private',
  status: 'published',
  isOwn: true,
  createdAt: '2026-10-02T00:00:00.000Z',
};

const page = (items: unknown[], total = items.length) => ({ items, page: 1, limit: 9, total, totalPages: 1 });

/** The page asks twice: for the list itself, and for the number of the learner's own passages (`limit: 1`). */
const answer = ({ items = [mine, theirs], own = 1 }: { items?: unknown[]; own?: number } = {}) =>
  list.mockImplementation(async (params: { limit?: number }) => (params.limit === 1 ? page([mine], own) : page(items)));

const twentyWords = Array.from({ length: 20 }, (_, index) => `chữ${index}`).join(' ');

const renderPage = () => renderWithProviders(<PassagesPage />, { route: '/passages' });

beforeEach(() => {
  list.mockReset();
  create.mockReset();
  remove.mockReset();
  requestPublic.mockReset();
  withdrawRequest.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  answer();
});

describe('PassagesPage', () => {
  it('lists the passages to practice, newest first, with Practice links and Delete on own passages only', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'New passage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Passages' })).toBeInTheDocument();
    expect(await screen.findByText('Hà Nội vào thu')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 9, sort: '-createdAt', q: undefined, visibility: undefined });
    expect(screen.getByText('2 passages')).toBeInTheDocument();
    expect(screen.getByText('40 words')).toBeInTheDocument();
    expect(screen.getByText('by TypeTrace')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Practice Hà Nội vào thu' })).toHaveAttribute('href', '/typing?passage=p1');
    expect(screen.getByRole('link', { name: 'Practice Bài của tôi' })).toHaveAttribute('href', '/typing?passage=p2');
    expect(screen.getByRole('button', { name: 'Delete Bài của tôi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Hà Nội vào thu' })).not.toBeInTheDocument();
  });

  it('searches the titles and keeps only the own private passages with the Private filter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    list.mockImplementation(async (params: { limit?: number }) => (params.limit === 1 ? page([mine], 1) : page([])));
    await user.type(screen.getByLabelText('Search passages'), 'thu{Enter}');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, q: 'thu', visibility: undefined })));
    expect(await screen.findByText('No matching passages')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    await user.click(within(screen.getByRole('group', { name: 'Visibility' })).getByRole('menuitemradio', { name: 'Private' }));
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: 'thu', visibility: 'private' })));
  });

  it('shows an empty state when there is no passage at all', async () => {
    answer({ items: [], own: 0 });
    renderPage();

    expect(await screen.findByText('No passages yet')).toBeInTheDocument();
  });

  it('shows the backend error with a retry button', async () => {
    let fail = true;
    list.mockImplementation(async (params: { limit?: number }) => {
      if (params.limit === 1) return page([mine], 1);
      if (fail) throw { response: { status: 500, data: { message: 'Database offline' } } };
      return page([theirs]);
    });
    renderPage();

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hà Nội vào thu')).toBeInTheDocument();
  });

  it('adds a pasted text without a title when none is given, then clears the form', async () => {
    create.mockResolvedValue({ ...mine, _id: 'p3' });
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    fireEvent.change(screen.getByLabelText('Content'), { target: { value: twentyWords } });
    expect(screen.getByText(`20 words · ${twentyWords.length}/5000`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ content: twentyWords }));
    await waitFor(() => expect(screen.getByLabelText('Content')).toHaveValue(''));
    expect(toast.success).toHaveBeenCalledWith('Passage added.');
  });

  it('sends the title when there is one', async () => {
    create.mockResolvedValue({ ...mine, _id: 'p3' });
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bài mới' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: twentyWords } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ title: 'Bài mới', content: twentyWords }));
  });

  it('counts and checks the text as it will be saved: cleaned like the backend does', async () => {
    create.mockResolvedValue({ ...mine, _id: 'p3' });
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    // HTML tags are not words, and `…` becomes `...`, so this title is 122 characters once cleaned.
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: `${'a'.repeat(119)}…` } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: `<p>${twentyWords}</p>` } });
    expect(screen.getByText(`20 words · ${twentyWords.length}/5000`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    expect(await screen.findByText('Max 120 characters')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '“Bài” mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ title: '"Bài" mới', content: twentyWords }));
  });

  it('does not send a text under 20 words, and says why', async () => {
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'một hai ba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    expect(await screen.findByText('At least 20 words')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the problem the backend found in the cleaned text, and keeps what was typed', async () => {
    create.mockRejectedValue({
      response: { status: 400, data: { message: 'Validation failed', errors: [{ field: 'content', message: 'At least 20 words' }] } },
    });
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    fireEvent.change(screen.getByLabelText('Content'), { target: { value: twentyWords } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('At least 20 words'));
    expect(screen.getByLabelText('Content')).toHaveValue(twentyWords);
  });

  it('counts the own passages and stops adding at 20', async () => {
    answer({ own: 3 });
    const { unmount } = renderPage();
    expect(await screen.findByText('Your passages: 3/20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add passage' })).toBeEnabled();
    unmount();

    answer({ own: 20 });
    renderPage();
    expect(await screen.findByText('Your passages: 20/20. Delete one to add another.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add passage' })).toBeDisabled();
  });

  it('deletes an own passage after confirmation', async () => {
    const user = userEvent.setup();
    remove.mockResolvedValue(undefined);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete Bài của tôi' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('"Bài của tôi" will be removed from your passages. Your typing results stay.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('p2'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Passage deleted.');
  });

  it('goes back a page when the last passage of the last page is deleted', async () => {
    const user = userEvent.setup();
    let deleted = false;
    remove.mockImplementation(async () => {
      deleted = true;
    });
    // 10 passages: page 2 holds only `mine`. Once it is deleted, 9 are left and all fit on page 1.
    list.mockImplementation(async (params: { limit?: number; page?: number }) => {
      if (params.limit === 1) return page([mine], deleted ? 0 : 1);
      const total = deleted ? 9 : 10;
      const totalPages = Math.ceil(total / 9);
      if (params.page === 2) return { items: deleted ? [] : [mine], page: 2, limit: 9, total, totalPages };
      return { items: [theirs], page: 1, limit: 9, total, totalPages };
    });
    renderWithProviders(<PassagesPage />, { route: '/passages?page=2' });

    await user.click(await screen.findByRole('button', { name: 'Delete Bài của tôi' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Hà Nội vào thu')).toBeInTheDocument();
    expect(screen.getByText('9 passages')).toBeInTheDocument();
    expect(screen.queryByText('No passages yet')).not.toBeInTheDocument();
  });

  describe('asking for a passage to become public (SCRUM-176)', () => {
    const waiting = { ...mine, _id: 'p3', title: 'Đang chờ', status: 'pending' };
    const refused = { ...mine, _id: 'p4', title: 'Bị từ chối', reviewNote: 'Trùng nội dung' };
    const approved = { ...mine, _id: 'p5', title: 'Đã công khai', visibility: 'public' };

    it('shows where each own passage stands, and why a request was turned down', async () => {
      answer({ items: [waiting, refused, approved, theirs] });
      renderPage();

      expect(await screen.findByText('Pending review')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Reason: Trùng nội dung')).toBeInTheDocument();
      expect(screen.getByText('Public')).toBeInTheDocument();

      // Waiting: it can be taken back (or deleted), not asked for again.
      expect(screen.getByRole('button', { name: 'Withdraw request Đang chờ' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Request public Đang chờ' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Đang chờ' })).toBeInTheDocument();
      // Turned down: it can be asked for again.
      expect(screen.getByRole('button', { name: 'Request public Bị từ chối' })).toBeInTheDocument();
      // Public: only an admin can change it now. Nor can anyone else's passage be changed.
      for (const title of ['Đã công khai', 'Hà Nội vào thu']) {
        expect(screen.queryByRole('button', { name: `Delete ${title}` })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: `Request public ${title}` })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: `Withdraw request ${title}` })).not.toBeInTheDocument();
      }
      expect(screen.getByRole('link', { name: 'Practice Đang chờ' })).toHaveAttribute('href', '/typing?passage=p3');
    });

    it('sends the request after a confirmation', async () => {
      const user = userEvent.setup();
      requestPublic.mockResolvedValue({ ...mine, status: 'pending' });
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Request public Bài của tôi' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('heading', { name: 'Make this passage public?' })).toBeInTheDocument();
      expect(within(dialog).getByText(/An admin will review "Bài của tôi"/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Send request' }));

      await waitFor(() => expect(requestPublic).toHaveBeenCalledWith('p2'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(toast.success).toHaveBeenCalledWith('Request sent: an admin will review it.');
    });

    it('says which author name everyone will see: the display name, never the email', async () => {
      const user = userEvent.setup();
      const cases = [
        ['Lan', 'It will show your display name, "Lan".'],
        [undefined, 'It will show "Anonymous learner": set a display name in your profile to show yours.'],
      ] as const;
      for (const [displayName, shownAs] of cases) {
        const queryClient = createTestQueryClient();
        queryClient.setQueryData(currentUserKey, { _id: 'u1', email: 'lan@example.com', displayName, role: 'user' });
        renderWithProviders(<PassagesPage />, { route: '/passages', queryClient });

        await user.click(await screen.findByRole('button', { name: 'Request public Bài của tôi' }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent(shownAs);
        expect(dialog).not.toHaveTextContent('lan@example.com');
        cleanup();
      }
    });

    it('does not send the request when the confirmation is cancelled', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Request public Bài của tôi' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(requestPublic).not.toHaveBeenCalled();
    });

    it('takes a request back', async () => {
      const user = userEvent.setup();
      answer({ items: [waiting] });
      withdrawRequest.mockResolvedValue({ ...waiting, status: 'published' });
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Withdraw request Đang chờ' }));

      await waitFor(() => expect(withdrawRequest).toHaveBeenCalledWith('p3'));
      expect(toast.success).toHaveBeenCalledWith('Request withdrawn.');
    });
  });
});
