import userEvent from '@testing-library/user-event';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { createTestQueryClient, renderWithProviders } from '@/test/render-with-providers';
import { PassagesPage } from './PassagesPage';

const list = vi.fn();
const get = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const requestPublic = vi.fn();
const withdrawRequest = vi.fn();

vi.mock('../api/learner-passages.api', () => ({
  learnerPassagesApi: {
    list: (params: unknown) => list(params),
    get: (id: string) => get(id),
    create: (input: unknown) => create(input),
    update: (id: string, input: unknown) => update(id, input),
    remove: (id: string) => remove(id),
    requestPublic: (id: string) => requestPublic(id),
    withdrawRequest: (id: string) => withdrawRequest(id),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The page only lists the learner's own passages (`mine: true`): this one an admin approved, so it is public.
const approvedMine = {
  _id: 'p1',
  title: 'Hà Nội vào thu',
  source: 'Sách Tiếng Việt lớp 5',
  wordCount: 40,
  ownerName: 'Lan',
  visibility: 'public',
  status: 'published',
  isOwn: true,
  // Midday UTC: the same day in every time zone the tests may run in.
  createdAt: '2026-10-01T12:00:00.000Z',
};
const mine = {
  _id: 'p2',
  title: 'Bài của tôi',
  source: 'Tự viết',
  wordCount: 25,
  ownerName: 'Lan',
  visibility: 'private',
  status: 'published',
  isOwn: true,
  createdAt: '2026-10-02T00:00:00.000Z',
};

const page = (items: unknown[], total = items.length) => ({ items, page: 1, limit: 10, total, totalPages: 1 });

/** The page asks twice: for the list itself, and for the number of the learner's own passages (`limit: 1`). */
const answer = ({ items = [mine, approvedMine], own = 1 }: { items?: unknown[]; own?: number } = {}) =>
  list.mockImplementation(async (params: { limit?: number }) => (params.limit === 1 ? page([mine], own) : page(items)));

const twentyWords = Array.from({ length: 20 }, (_, index) => `chữ${index}`).join(' ');

const renderPage = () => renderWithProviders(<PassagesPage />, { route: '/passages' });

beforeEach(() => {
  list.mockReset();
  get.mockReset();
  create.mockReset();
  update.mockReset();
  remove.mockReset();
  requestPublic.mockReset();
  withdrawRequest.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  answer();
});

describe('PassagesPage', () => {
  it('lists only the learner own passages, newest first, one row each like the admin users list', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'New passage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My passages' })).toBeInTheDocument();
    expect(await screen.findByText('Hà Nội vào thu')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 10, sort: '-createdAt', q: undefined, visibility: undefined, mine: true });
    expect(screen.getByText('2 passages')).toBeInTheDocument();

    // One row per passage: title and source on the left, the word count on the right, where it stands and the day below.
    const row = screen.getByRole('heading', { name: 'Hà Nội vào thu' }).closest('article')!;
    expect(within(row).getByText('Sách Tiếng Việt lớp 5')).toBeInTheDocument();
    expect(within(row).getByText('WORDS')).toBeInTheDocument();
    expect(within(row).getByText('40')).toBeInTheDocument();
    expect(within(row).getByText('Public')).toBeInTheDocument();
    expect(within(row).getByText('01 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);

    expect(screen.getByRole('link', { name: 'Practice Hà Nội vào thu' })).toHaveAttribute('href', '/typing?passage=p1');
    expect(screen.getByRole('link', { name: 'Practice Bài của tôi' })).toHaveAttribute('href', '/typing?passage=p2');
    expect(screen.getByRole('button', { name: 'Delete Bài của tôi' })).toBeInTheDocument();
    // Approved, so public now: only an admin can remove it.
    expect(screen.queryByRole('button', { name: 'Delete Hà Nội vào thu' })).not.toBeInTheDocument();
  });

  it('searches the titles and keeps only the own private passages with the Private filter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    list.mockImplementation(async (params: { limit?: number }) => (params.limit === 1 ? page([mine], 1) : page([])));
    await user.type(screen.getByLabelText('Search passages'), 'thu{Enter}');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, q: 'thu', visibility: undefined, mine: true })));
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
      return page([approvedMine]);
    });
    renderPage();

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hà Nội vào thu')).toBeInTheDocument();
  });

  it('adds a passage with its title, source and text, then clears the form', async () => {
    create.mockResolvedValue({ ...mine, _id: 'p3' });
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bài mới' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Tự viết' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: twentyWords } });
    expect(screen.getByText(`20 words · ${twentyWords.length}/5000`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ title: 'Bài mới', source: 'Tự viết', content: twentyWords }));
    await waitFor(() => expect(screen.getByLabelText('Content')).toHaveValue(''));
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Source')).toHaveValue('');
    expect(toast.success).toHaveBeenCalledWith('Passage added.');
  });

  it('does not send a passage without a title or a source, also when they are only spaces or tags', async () => {
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    fireEvent.change(screen.getByLabelText('Content'), { target: { value: twentyWords } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Source is required')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '<b></b>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    await waitFor(() => expect(screen.getByText('Title is required')).toBeInTheDocument());
    expect(screen.getByText('Source is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('counts and checks the text as it will be saved: cleaned like the backend does', async () => {
    create.mockResolvedValue({ ...mine, _id: 'p3' });
    renderPage();
    await screen.findByText('Hà Nội vào thu');

    // HTML tags are not words, and `…` becomes `...`, so this title is 122 characters once cleaned.
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: `${'a'.repeat(119)}…` } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: ' <i>Sách</i>  Tiếng Việt ' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: `<p>${twentyWords}</p>` } });
    expect(screen.getByText(`20 words · ${twentyWords.length}/5000`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    expect(await screen.findByText('Max 120 characters')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '“Bài” mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ title: '"Bài" mới', source: 'Sách Tiếng Việt', content: twentyWords }));
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

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bài mới' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Tự viết' } });
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
    // 11 passages: page 2 holds only `mine`. Once it is deleted, 10 are left and all fit on page 1.
    list.mockImplementation(async (params: { limit?: number; page?: number }) => {
      if (params.limit === 1) return page([mine], deleted ? 0 : 1);
      const total = deleted ? 10 : 11;
      const totalPages = Math.ceil(total / 10);
      if (params.page === 2) return { items: deleted ? [] : [mine], page: 2, limit: 10, total, totalPages };
      return { items: [approvedMine], page: 1, limit: 10, total, totalPages };
    });
    renderWithProviders(<PassagesPage />, { route: '/passages?page=2' });

    await user.click(await screen.findByRole('button', { name: 'Delete Bài của tôi' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Hà Nội vào thu')).toBeInTheDocument();
    expect(screen.getByText('10 passages')).toBeInTheDocument();
    expect(screen.queryByText('No passages yet')).not.toBeInTheDocument();
  });

  it('pages through the own passages 10 at a time, with the pages at the bottom right like the admin users list', async () => {
    const user = userEvent.setup();
    list.mockImplementation(async (params: { limit?: number; page?: number }) =>
      params.limit === 1 ? page([mine], 1) : { items: [params.page === 2 ? approvedMine : mine], page: params.page ?? 1, limit: 10, total: 11, totalPages: 2 },
    );
    renderPage();

    const pages = await screen.findByRole('navigation', { name: 'Pagination' });
    expect(pages).toHaveClass('justify-end');
    expect(within(pages).getByText('Page 1 of 2')).toBeInTheDocument();
    await user.click(within(pages).getByRole('button', { name: /Next/ }));

    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 10, mine: true })));
    expect(await screen.findByText('Hà Nội vào thu')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('shows the actions as icon buttons at the right of each row', async () => {
    renderPage();

    const row = (await screen.findByRole('heading', { name: 'Bài của tôi' })).closest('article')!;
    const actions = [
      within(row).getByRole('link', { name: 'Practice Bài của tôi' }),
      within(row).getByRole('button', { name: 'Edit Bài của tôi' }),
      within(row).getByRole('button', { name: 'Request public Bài của tôi' }),
      within(row).getByRole('button', { name: 'Delete Bài của tôi' }),
    ];
    // Icons only: the name is for screen readers, the hint shows on hover.
    expect(actions.map((action) => action.textContent)).toEqual(['', '', '', '']);
    expect(actions.map((action) => action.getAttribute('title'))).toEqual(['Practice', 'Edit', 'Request public', 'Delete']);
  });

  describe('editing an own passage', () => {
    it('opens it in the top panel, saves it with Update passage, then goes back to New passage', async () => {
      const user = userEvent.setup();
      get.mockResolvedValue({ ...mine, source: 'Tự viết', content: twentyWords });
      update.mockResolvedValue({ ...mine, title: 'Bài đã sửa' });
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Edit Bài của tôi' }));

      expect(await screen.findByRole('heading', { name: 'Edit passage' })).toBeInTheDocument();
      expect(get).toHaveBeenCalledWith('p2');
      expect(await screen.findByLabelText('Content')).toHaveValue(twentyWords);
      expect(screen.getByLabelText('Title')).toHaveValue('Bài của tôi');
      expect(screen.getByLabelText('Source')).toHaveValue('Tự viết');
      expect(screen.queryByRole('button', { name: 'Add passage' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Your passages:/)).not.toBeInTheDocument();

      await user.clear(screen.getByLabelText('Title'));
      await user.type(screen.getByLabelText('Title'), 'Bài đã sửa');
      await user.click(screen.getByRole('button', { name: 'Update passage' }));

      await waitFor(() => expect(update).toHaveBeenCalledWith('p2', { title: 'Bài đã sửa', source: 'Tự viết', content: twentyWords }));
      expect(await screen.findByRole('heading', { name: 'New passage' })).toBeInTheDocument();
      expect(screen.getByLabelText('Content')).toHaveValue('');
      expect(toast.success).toHaveBeenCalledWith('Passage updated.');
    });

    it('cancels without saving', async () => {
      const user = userEvent.setup();
      get.mockResolvedValue({ ...mine, source: 'Tự viết', content: twentyWords });
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Edit Bài của tôi' }));
      await screen.findByDisplayValue(twentyWords);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('heading', { name: 'New passage' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add passage' })).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
    });

    it('goes back to New passage when the passage being edited is deleted', async () => {
      const user = userEvent.setup();
      get.mockResolvedValue({ ...mine, source: 'Tự viết', content: twentyWords });
      remove.mockResolvedValue(undefined);
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Edit Bài của tôi' }));
      await screen.findByDisplayValue(twentyWords);
      await user.click(screen.getByRole('button', { name: 'Delete Bài của tôi' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByRole('heading', { name: 'New passage' })).toBeInTheDocument();
    });
  });

  describe('asking for a passage to become public (SCRUM-176)', () => {
    const waiting = { ...mine, _id: 'p3', title: 'Đang chờ', status: 'pending' };
    const refused = { ...mine, _id: 'p4', title: 'Bị từ chối', status: 'rejected', reviewNote: 'Trùng nội dung' };
    const approved = { ...mine, _id: 'p5', title: 'Đã công khai', visibility: 'public' };

    it('shows where each own passage stands, and why a request was turned down', async () => {
      answer({ items: [waiting, refused, approved] });
      renderPage();

      expect(await screen.findByText('Pending review')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Reason: Trùng nội dung')).toBeInTheDocument();
      expect(screen.getByText('Public')).toBeInTheDocument();

      // Waiting: it can be taken back (or deleted), not edited or asked for again.
      expect(screen.getByRole('button', { name: 'Withdraw request Đang chờ' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Request public Đang chờ' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit Đang chờ' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Đang chờ' })).toBeInTheDocument();
      // Turned down: it can be edited and asked for again.
      expect(screen.getByRole('button', { name: 'Request public Bị từ chối' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit Bị từ chối' })).toBeInTheDocument();
      // Public: only an admin can change it now.
      expect(screen.queryByRole('button', { name: 'Delete Đã công khai' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit Đã công khai' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Request public Đã công khai' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Withdraw request Đã công khai' })).not.toBeInTheDocument();
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
