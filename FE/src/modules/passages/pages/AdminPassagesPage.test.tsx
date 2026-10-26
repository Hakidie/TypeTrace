import userEvent from '@testing-library/user-event';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { REVIEW_QUEUE_REFRESH_MS } from '../hooks/use-passages';
import { AdminPassagesPage } from './AdminPassagesPage';

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const setStatus = vi.fn();
const approve = vi.fn();
const reject = vi.fn();
const bulkApprove = vi.fn();
const bulkReject = vi.fn();
const remove = vi.fn();

vi.mock('../api/passages.api', () => ({
  passagesApi: { list: (params: unknown) => list(params), create: (input: unknown) => create(input),
    update: (id: string, input: unknown) => update(id, input),
    setStatus: (id: string, status: unknown) => setStatus(id, status),
    remove: (id: string) => remove(id),
    approve: (id: string) => approve(id),
    reject: (id: string, reason: string) => reject(id, reason),
    bulkApprove: (ids: string[]) => bulkApprove(ids),
    bulkReject: (ids: string[], reason: string) => bulkReject(ids, reason),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const passage = {
  _id: 'p1',
  title: 'Mùa thu Hà Nội',
  content: 'Hà Nội mùa thu thật đẹp.',
  source: 'TypeTrace',
  ownerName: 'TypeTrace',
  status: 'draft',
  isPlacement: false,
  wordCount: 6,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const page = (items: unknown[]) => ({ items, page: 1, limit: 9, total: items.length, totalPages: 1 });

/** Both panels ask: the passage bank for the public passages, the Pending review panel below for `status: 'pending'`. */
const answer = ({ bank = [passage], pending = [] }: { bank?: unknown[]; pending?: unknown[] } = {}) =>
  list.mockImplementation(async (params: { status?: string; limit?: number }) =>
    params.status === 'pending'
      ? { items: pending, page: 1, limit: params.limit, total: pending.length, totalPages: 1 }
      : page(bank),
  );

const renderPage = () => renderWithProviders(<AdminPassagesPage />, { route: '/admin/passages' });

beforeEach(() => {
  list.mockReset();
  answer();
  create.mockReset();
  update.mockReset();
  setStatus.mockReset();
});

describe('AdminPassagesPage', () => {
  it('has a New passage panel and a Passages panel with the cards', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'New passage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Passages' })).toBeInTheDocument();
    expect(await screen.findByText('Mùa thu Hà Nội')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('6 words')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 9, visibility: 'public' }));
  });

  it('shows an empty state without any example card', async () => {
    answer({ bank: [] });
    renderPage();

    expect(await screen.findByText('No passages yet')).toBeInTheDocument();
    expect(screen.queryByText('Phố cổ buổi sớm')).not.toBeInTheDocument();
  });

  it('shows the backend error with a retry button', async () => {
    // Only the passage bank fails here; the Pending review panel below is empty.
    list.mockImplementation(async (params: { status?: string }) => {
      if (params.status === 'pending') return page([]);
      throw { response: { status: 500, data: { message: 'Database offline' } } };
    });
    renderPage();

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    answer({ bank: [passage] });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Mùa thu Hà Nội')).toBeInTheDocument();
  });

  it('creates a passage and clears the form', async () => {
    create.mockResolvedValue({ ...passage, _id: 'p2' });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Biển' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'TypeTrace' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Biển xanh bao la.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        title: 'Biển',
        source: 'TypeTrace',
        content: 'Biển xanh bao la.',
        isPlacement: false,
      }),
    );
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue(''));
  });

  it('does not send a text over 200 words, and says why', async () => {
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Dài' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'TypeTrace' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: Array(201).fill('từ').join(' ') } });
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    expect(await screen.findByText('At most 200 words')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('counts the words and can mark the passage as a placement passage', async () => {
    create.mockResolvedValue({ ...passage, _id: 'p3', isPlacement: true });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Kiểm tra' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'TypeTrace' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'một hai ba' } });
    expect(screen.getByText('3/200 words')).toBeInTheDocument();

    const placement = screen.getByRole('switch', { name: 'Placement passage' });
    expect(placement).toHaveAttribute('aria-checked', 'false');
    expect(placement).toHaveTextContent('Regular passage');
    fireEvent.click(placement);
    expect(placement).toHaveAttribute('aria-checked', 'true');
    expect(placement).toHaveTextContent('Placement passage');
    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ title: 'Kiểm tra', source: 'TypeTrace', content: 'một hai ba', isPlacement: true }),
    );
  });

  it('does not submit an empty form', async () => {
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.click(screen.getByRole('button', { name: 'Add passage' }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Source is required')).toBeInTheDocument();
    expect(screen.getByText('Content is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('edits a passage in the top form and goes back to the New passage form', async () => {
    update.mockResolvedValue({ ...passage, title: 'Biển' });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));

    expect(screen.getByRole('heading', { name: 'Edit passage' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Mùa thu Hà Nội');
    expect(screen.getByLabelText('Content')).toHaveValue('Hà Nội mùa thu thật đẹp.');
    expect(screen.queryByRole('button', { name: 'Add passage' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Biển' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update passage' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('p1', {
        title: 'Biển',
        source: 'TypeTrace',
        content: 'Hà Nội mùa thu thật đẹp.',
        isPlacement: false,
      }),
    );
    expect(await screen.findByRole('heading', { name: 'New passage' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(create).not.toHaveBeenCalled();
  });

  it('cancels editing without saving', async () => {
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { name: 'New passage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add passage' })).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('only shows the status on the card: it is changed in the edit form', async () => {
    answer({ bank: [{ ...passage, status: 'published' }] });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /status/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
  });

  it('shows the status of the passage in the edit form', async () => {
    answer({ bank: [{ ...passage, status: 'published' }] });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));

    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update passage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status: published' })).toHaveClass('bg-primary');
  });

  it('shows a draft passage status like the Regular passage chip, left of Cancel', async () => {
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');
    expect(screen.queryByRole('button', { name: /^Status/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));

    const status = screen.getByRole('button', { name: 'Status: draft' });
    expect(status).toHaveTextContent('draft');
    expect(status).toHaveClass('bg-muted');
    expect(status.compareDocumentPosition(screen.getByRole('button', { name: 'Cancel' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('changes the status with the status button and saves it with Update passage', async () => {
    update.mockResolvedValue(passage);
    setStatus.mockResolvedValue({ ...passage, status: 'published' });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));

    fireEvent.click(screen.getByRole('button', { name: 'Status: draft' }));
    expect(screen.getByRole('button', { name: 'Status: published' })).toHaveClass('bg-primary');
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Status: published' }));
    expect(screen.getByRole('button', { name: 'Status: archived' })).toHaveClass('bg-muted');
    fireEvent.click(screen.getByRole('button', { name: 'Status: archived' }));
    expect(screen.getByRole('button', { name: 'Status: draft' })).toHaveClass('bg-muted');
    expect(setStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Status: draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update passage' }));

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('p1', 'published'));
    expect(update).toHaveBeenCalled();
  });

  it('moves an archived passage to draft, then published', async () => {
    answer({ bank: [{ ...passage, status: 'archived' }] });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));

    fireEvent.click(screen.getByRole('button', { name: 'Status: archived' }));
    expect(screen.getByRole('button', { name: 'Status: draft' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Status: draft' }));
    expect(screen.getByRole('button', { name: 'Status: published' })).toBeInTheDocument();
  });

  it('deletes an archived passage for good after a confirmation, and only an archived one', async () => {
    answer({ bank: [passage, { ...passage, _id: 'p2', title: 'Old one', status: 'archived' }] });
    remove.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Old one');

    expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Old one' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('p2'));
  });

  it('lets an admin archive a placement passage with the status button', async () => {
    answer({ bank: [{ ...passage, status: 'published', isPlacement: true }] });
    update.mockResolvedValue({ ...passage, status: 'published', isPlacement: true });
    setStatus.mockResolvedValue({ ...passage, status: 'archived' });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));

    fireEvent.click(screen.getByRole('button', { name: 'Status: published' }));
    expect(screen.getByRole('button', { name: 'Status: archived' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update passage' }));

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('p1', 'archived'));
    expect(update).toHaveBeenCalledWith('p1', expect.objectContaining({ isPlacement: true }));
  });
});

describe('AdminPassagesPage: search, filters, sort and hard delete of the passage bank (SCRUM-159)', () => {
  /** Shows the query string of the page, to check what the passage bank keeps in the URL. */
  const LocationProbe = () => <output aria-label="URL">{useLocation().search}</output>;

  const renderAt = (route: string) =>
    renderWithProviders(
      <>
        <AdminPassagesPage />
        <LocationProbe />
      </>,
      { route },
    );

  const urlParams = () => new URLSearchParams(screen.getByLabelText('URL').textContent ?? '');

  /** The toolbar of the Passages panel, apart from the one of the Pending review panel below. */
  const bankToolbar = () => screen.getByLabelText('Search passages').closest('div.flex')!.parentElement!;

  /** Picks `option` in the Sort or the Filter menu of the passage bank. */
  const pick = async (user: ReturnType<typeof userEvent.setup>, menu: string | RegExp, option: string) => {
    await user.click(within(bankToolbar()).getByRole('button', { name: menu }));
    await user.click(await screen.findByRole('menuitemradio', { name: option }));
  };

  /** A bank of `totalPages` pages that answers the page it is asked for; the review queue is empty. */
  const answerPages = (totalPages: number) =>
    list.mockImplementation(async (params: { status?: string; page?: number }) =>
      params.status === 'pending'
        ? page([])
        : { items: [passage], page: params.page ?? 1, limit: 9, total: totalPages * 9, totalPages },
    );

  /** Opens the edit form of the only passage, then asks to delete it from there. */
  const deleteFromForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));
    await user.click(screen.getByRole('button', { name: 'Delete passage' }));
    return screen.findByRole('dialog', { name: 'Delete this passage for good?' });
  };

  beforeEach(() => {
    remove.mockReset();
    vi.mocked(toast.success).mockClear();
  });

  it('searches, filters and sorts the passage bank, keeping each choice in the URL', async () => {
    answerPages(3);
    const user = userEvent.setup();
    renderAt('/admin/passages?page=2');
    await screen.findByText('Mùa thu Hà Nội');
    expect(list).toHaveBeenCalledWith({ page: 2, limit: 9, sort: '-createdAt', visibility: 'public' });

    // A search (on Enter) looks in the title and the source, from the first page.
    await user.type(screen.getByLabelText('Search passages'), 'hà nội{Enter}');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: 'hà nội', page: 1, visibility: 'public' })));
    expect(urlParams().get('q')).toBe('hà nội');
    expect(urlParams().get('page')).toBeNull();

    // Filters: the status, and the placement passages or the regular ones.
    await pick(user, /Filter/, 'Archived');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: 'hà nội', status: 'archived' })));
    await pick(user, /Filter/, 'Placement');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived', isPlacement: true })));
    expect(within(bankToolbar()).getByLabelText('2 active')).toBeInTheDocument();
    expect(urlParams().get('status')).toBe('archived');
    expect(urlParams().get('type')).toBe('placement');
    await pick(user, /Filter/, 'Regular');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived', isPlacement: false })));
    // "All" takes a filter off again.
    await user.click(within(bankToolbar()).getByRole('button', { name: /Filter/ }));
    await user.click(within(await screen.findByRole('group', { name: 'Status' })).getByRole('menuitemradio', { name: 'All' }));
    await waitFor(() => expect(urlParams().get('status')).toBeNull());
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'hà nội', status: undefined, isPlacement: false }));

    // Sort: the default one stays out of the URL.
    await pick(user, 'Sort', 'Title A–Z');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ sort: 'title', q: 'hà nội', isPlacement: false })));
    expect(urlParams().get('sort')).toBe('title');
    await pick(user, 'Sort', 'Longest');
    await waitFor(() => expect(urlParams().get('sort')).toBe('-wordCount'));
    await pick(user, 'Sort', 'Newest');
    await waitFor(() => expect(urlParams().get('sort')).toBeNull());

    // The review queue below keeps its own search and its own names in the URL.
    expect(list).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', q: 'hà nội' }));
    expect([...urlParams().keys()].some((key) => key.startsWith('pending-'))).toBe(false);
  });

  it('opens with the search, filters, sort and page of the URL, as after a reload or from a shared link', async () => {
    answerPages(3);
    const user = userEvent.setup();
    renderAt('/admin/passages?q=biển&status=archived&type=placement&sort=title&page=2');
    await screen.findByText('Mùa thu Hà Nội');

    expect(list).toHaveBeenCalledWith({
      page: 2,
      limit: 9,
      sort: 'title',
      q: 'biển',
      status: 'archived',
      isPlacement: true,
      visibility: 'public',
    });
    expect(screen.getByLabelText('Search passages')).toHaveValue('biển');
    expect(within(bankToolbar()).getByText('27 passages')).toBeInTheDocument();
    expect(within(bankToolbar()).getByLabelText('2 active')).toBeInTheDocument();
    await user.click(within(bankToolbar()).getByRole('button', { name: 'Sort' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Title A–Z' })).toHaveAttribute('aria-checked', 'true');
  });

  it('goes back to the last page when the page of the URL is past the end', async () => {
    answerPages(2);
    renderAt('/admin/passages?page=5');

    await waitFor(() => expect(urlParams().get('page')).toBe('2'));
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, visibility: 'public' }));
    expect(await screen.findByText('Mùa thu Hà Nội')).toBeInTheDocument();
  });

  it('says when no passage matches the search or the filters', async () => {
    answer({ bank: [] });
    renderAt('/admin/passages?q=xyz&status=draft');

    expect(await screen.findByText('No matching passages')).toBeInTheDocument();
    expect(screen.getByText('Try another search or filter.')).toBeInTheDocument();
    expect(screen.queryByText('No passages yet')).not.toBeInTheDocument();
  });

  it('deletes an archived passage for good from the edit form, after a confirmation', async () => {
    answer({ bank: [{ ...passage, status: 'archived' }] });
    remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');
    expect(within(bankToolbar()).getByText('1 passage')).toBeInTheDocument();

    const dialog = await deleteFromForm(user);
    expect(
      within(dialog).getByText('"Mùa thu Hà Nội" is removed for good. A passage learners have typed cannot be deleted.'),
    ).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('p1'));
    expect(toast.success).toHaveBeenCalledWith('Passage deleted.');
    // The passage is gone: the form goes back to a new passage.
    expect(await screen.findByRole('heading', { name: 'New passage' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the passage and its edit form when the confirmation is cancelled', async () => {
    answer({ bank: [{ ...passage, status: 'archived' }] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    const dialog = await deleteFromForm(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Edit passage' })).toBeInTheDocument();
  });

  it('stays on the passage when the backend refuses to delete it', async () => {
    answer({ bank: [{ ...passage, status: 'archived' }] });
    remove.mockRejectedValue({
      response: { status: 409, data: { message: 'Learners have typed this passage: it cannot be deleted, only archived' } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    const dialog = await deleteFromForm(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    // The confirmation closes (the backend message is toasted), and the passage stays open in the edit form.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Edit passage' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Mùa thu Hà Nội');
  });

  it('offers the hard delete only on an archived passage that is not a placement passage, on the card and in the form', async () => {
    answer({
      bank: [
        { ...passage, _id: 'p1', title: 'Đang dùng', status: 'published' },
        { ...passage, _id: 'p2', title: 'Kiểm tra cũ', status: 'archived', isPlacement: true },
        { ...passage, _id: 'p3', title: 'Bài cũ', status: 'archived' },
      ],
    });
    renderPage();
    await screen.findByText('Bài cũ');

    expect(screen.getAllByRole('button', { name: /^Delete / }).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Delete Bài cũ',
    ]);
    for (const title of ['Đang dùng', 'Kiểm tra cũ']) {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${title}` }));
      expect(screen.getByLabelText('Title')).toHaveValue(title);
      expect(screen.queryByRole('button', { name: 'Delete passage' })).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bài cũ' }));
    expect(screen.getByRole('button', { name: 'Delete passage' })).toBeInTheDocument();
  });
});

describe('AdminPassagesPage: Pending review panel (SCRUM-176)', () => {
  const waitingA = {
    ...passage,
    _id: 'pA',
    title: 'Sông quê',
    content: 'Dòng sông quê hương hiền hòa chảy qua làng.',
    source: 'Sách Tiếng Việt lớp 5',
    ownerName: 'Lan',
    status: 'pending',
    visibility: 'private',
    wordCount: 21,
    updatedAt: '2026-10-20T12:00:00.000Z',
  };
  const waitingB = {
    ...waitingA,
    _id: 'pB',
    title: 'Biển xanh',
    content: 'Sóng biển xanh vỗ nhẹ vào bờ cát trắng.',
    ownerName: 'Minh',
    updatedAt: '2026-10-21T12:00:00.000Z',
  };

  const answerQueue = (items: unknown[] = [waitingA, waitingB]) => answer({ pending: items });

  /** Opens the page and waits for the cards of the queue. */
  const openPage = async () => {
    const user = userEvent.setup();
    renderPage();
    await within(await screen.findByLabelText('Passages waiting for review')).findByText('Sông quê');
    return user;
  };

  beforeEach(() => {
    approve.mockReset();
    reject.mockReset();
    bulkApprove.mockReset();
    bulkReject.mockReset();
    vi.mocked(toast.success).mockClear();
    answerQueue();
  });

  it('lists the requests below the Passages panel, without tabs, as cards like the passage bank, oldest first', async () => {
    renderPage();

    const passagesPanel = screen.getByRole('heading', { name: 'Passages' });
    const pendingPanel = screen.getByRole('heading', { name: 'Pending review' });
    expect(passagesPanel.compareDocumentPosition(pendingPanel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    const queue = await screen.findByLabelText('Passages waiting for review');
    expect(await within(queue).findByText('Sông quê')).toBeInTheDocument();
    expect(within(queue).getByText('by Lan · Sách Tiếng Việt lớp 5 · asked 20 Oct 2026')).toBeInTheDocument();
    expect(within(queue).getByText('Dòng sông quê hương hiền hòa chảy qua làng.')).toBeInTheDocument();
    expect(within(queue).getAllByText('21 words')).toHaveLength(2);
    expect(list).toHaveBeenCalledWith({ status: 'pending', page: 1, limit: 9, sort: 'updatedAt', q: undefined });
    expect(screen.getByText('2 waiting')).toBeInTheDocument();
    // The passage bank above holds only public passages: a learner's request is not part of it.
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public' }));
  });

  it('searches and sorts the requests, keeping them apart from the passage bank in the URL', async () => {
    const user = await openPage();

    await user.type(screen.getByLabelText('Search requests'), 'biển{Enter}');
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', q: 'biển', page: 1 })));

    const toolbar = screen.getByLabelText('Search requests').closest('div.flex')!.parentElement!;
    await user.click(within(toolbar).getByRole('button', { name: 'Sort' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Newest request' }));
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', q: 'biển', sort: '-updatedAt' })));
    // The bank is never searched with the text of the queue.
    expect(list).not.toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public', q: 'biển' }));
  });

  it('filters the queue by type: Edited (edits of public passages) or Pending (requests), kept in the URL', async () => {
    const user = await openPage();
    const toolbar = screen.getByLabelText('Search requests').closest('div.flex')!.parentElement!;

    await user.click(within(toolbar).getByRole('button', { name: /Filter/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Edited' }));
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', edited: true, page: 1 })));

    await user.click(within(toolbar).getByRole('button', { name: /Filter/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Pending' }));
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', edited: false })));
    // The passage bank above is not filtered by the queue.
    expect(list).not.toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public', edited: expect.anything() }));
  });

  it('shows an empty state when no request waits', async () => {
    answerQueue([]);
    renderPage();

    expect(await screen.findByText('Nothing to review')).toBeInTheDocument();
    expect(screen.getByText('0 waiting')).toBeInTheDocument();
  });

  it('lists an edit of a public passage in the queue with its proposed text, and approves it', async () => {
    const edit = {
      ...waitingA,
      _id: 'pE',
      title: 'Sông quê (cũ)',
      status: 'published',
      visibility: 'public',
      pendingEdit: { title: 'Sông quê mới', source: 'Sách mới', content: 'Dòng sông quê hương đổi mới.' },
    };
    approve.mockResolvedValue(edit);
    answerQueue([edit]);
    renderPage();
    const queue = await screen.findByLabelText('Passages waiting for review');

    // The card shows what is proposed, tagged Edited; the approved text is what everyone reads meanwhile.
    expect(await within(queue).findByText('Sông quê mới')).toBeInTheDocument();
    expect(within(queue).getByText('Dòng sông quê hương đổi mới.')).toBeInTheDocument();
    // Next to the status of the public passage, a tag says it is an edit.
    expect(within(queue).getByText('published')).toBeInTheDocument();
    expect(within(queue).getByText('Edited')).toBeInTheDocument();
    expect(within(queue).queryByText('Sông quê (cũ)')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(within(queue).getByRole('button', { name: 'View Sông quê mới' }));
    const view = await screen.findByRole('dialog', { name: 'Sông quê mới' });
    // What changes is marked word by word, in place (no extra lines): the old words struck through, the new ones highlighted.
    expect(within(view).getByText('(cũ)', { selector: 'del' })).toBeInTheDocument();
    expect(within(view).getByText('Tiếng Việt lớp 5', { selector: 'del' })).toBeInTheDocument();
    expect(within(view).getAllByText('mới', { selector: 'ins' })).toHaveLength(2);
    expect(within(view).getByText(/Source:/)).toHaveTextContent('Source: Sách Tiếng Việt lớp 5 mới');
    const changes = within(view).getByRole('group', { name: 'Changes' });
    expect(within(changes).getByText(/hiền hòa chảy qua làng\./, { selector: 'del' })).toBeInTheDocument();
    expect(within(changes).getByText(/đổi mới\./, { selector: 'ins' })).toBeInTheDocument();
    // The words that stay are plain.
    expect(within(changes).getByText(/Dòng sông quê hương/, { selector: 'span' })).toBeInTheDocument();
    expect(within(view).queryByText(/What the edit changes/)).not.toBeInTheDocument();
    await user.click(within(view).getByRole('button', { name: 'Approve' }));
    const confirm = await screen.findByRole('dialog', { name: 'Approve "Sông quê mới"?' });
    expect(within(confirm).getByText(/The edit replaces the public text/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approve).toHaveBeenCalledWith('pE'));
  });

  it('opens a request to read its whole text, and approves it from there after a confirmation', async () => {
    approve.mockResolvedValue({ ...waitingA, status: 'published', visibility: 'public' });
    const user = await openPage();

    await user.click(screen.getByRole('button', { name: 'View Sông quê' }));
    const view = await screen.findByRole('dialog', { name: 'Sông quê' });
    expect(within(view).getByText('Dòng sông quê hương hiền hòa chảy qua làng.')).toBeInTheDocument();
    expect(within(view).getByText('by Lan · 21 words')).toBeInTheDocument();
    expect(within(view).getByText('Source: Sách Tiếng Việt lớp 5')).toBeInTheDocument();
    await user.click(within(view).getByRole('button', { name: 'Approve' }));

    const confirm = await screen.findByRole('dialog', { name: 'Approve "Sông quê"?' });
    expect(approve).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approve).toHaveBeenCalledWith('pA'));
    expect(toast.success).toHaveBeenCalledWith('Passage approved.');
  });

  it('turns a request down only with a reason, which is sent', async () => {
    reject.mockResolvedValue({ ...waitingA, status: 'rejected', reviewNote: 'Trùng nội dung' });
    const user = await openPage();

    await user.click(screen.getByRole('button', { name: 'Reject Sông quê' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject "Sông quê"?' });
    const confirm = within(dialog).getByRole('button', { name: 'Reject' });
    expect(within(dialog).getByText('It stays private to its author, who sees your reason.')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Reason'), '   ');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText('Reason'));
    await user.type(within(dialog).getByLabelText('Reason'), 'Trùng nội dung');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(reject).toHaveBeenCalledWith('pA', 'Trùng nội dung'));
    expect(approve).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Passage turned down.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('approves or turns down the chosen requests at once, from buttons in the toolbar', async () => {
    bulkApprove.mockResolvedValue({ updated: 2 });
    bulkReject.mockResolvedValue({ updated: 1 });
    const user = await openPage();
    const queue = screen.getByLabelText('Passages waiting for review');
    // No Select all and no box on a card: a card is chosen by clicking it.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve 2' })).not.toBeInTheDocument();

    await user.click(within(queue).getByText('Sông quê'));
    await user.click(within(queue).getByText('Biển xanh'));
    expect(within(queue).getAllByText('Selected')).toHaveLength(2);
    // The buttons are parts of the toolbar of their own, like Sort and Filter, not inside the count.
    expect(screen.getByText('2 waiting')).not.toContainElement(screen.getByRole('button', { name: 'Approve 2' }));
    await user.click(screen.getByRole('button', { name: 'Approve 2' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Approve 2 passages?' })).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(bulkApprove).toHaveBeenCalledWith(['pA', 'pB']));
    expect(toast.success).toHaveBeenCalledWith('2 passages approved.');
    // A decision clears the choice.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve 2' })).not.toBeInTheDocument());
    expect(within(queue).queryByText('Selected')).not.toBeInTheDocument();

    // A second click on a card un-chooses it; Space chooses a focused card; the icon buttons do not choose it.
    await user.click(within(queue).getByText('Sông quê'));
    await user.click(within(queue).getByText('Sông quê'));
    expect(within(queue).queryByText('Selected')).not.toBeInTheDocument();
    within(queue).getByText('Sông quê').closest<HTMLElement>('[role="article"]')!.focus();
    await user.keyboard(' ');
    expect(within(queue).getAllByText('Selected')).toHaveLength(1);
    await user.click(within(queue).getByRole('button', { name: 'View Biển xanh' }));
    await user.keyboard('{Escape}');
    expect(within(queue).getAllByText('Selected')).toHaveLength(1);

    await user.click(within(queue).getByText('Biển xanh'));
    await user.click(screen.getByRole('button', { name: 'Reject 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject 2 passages?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Trùng nội dung');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(bulkReject).toHaveBeenCalledWith(['pA', 'pB'], 'Trùng nội dung'));
    expect(toast.success).toHaveBeenCalledWith('1 of 2 passages turned down: the others were no longer waiting.');
  });

  it('drops a request that was taken care of elsewhere: the dialog closes and the queue is asked for again', async () => {
    // Another admin approved it first (409), or its author deleted it (404).
    for (const status of [409, 404]) {
      approve.mockRejectedValueOnce({ response: { status, data: { message: 'This passage is not waiting for review' } } });
      answerQueue();
      const user = await openPage();
      answerQueue([waitingB]);

      await user.click(screen.getByRole('button', { name: 'Approve Sông quê' }));
      await user.click(within(await screen.findByRole('dialog', { name: 'Approve "Sông quê"?' })).getByRole('button', { name: 'Approve' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(await screen.findByText('1 waiting')).toBeInTheDocument();
      expect(screen.queryByText('Sông quê')).not.toBeInTheDocument();
      cleanup();
    }
  });

  it('keeps the dialog open to try again when the server cannot be reached', async () => {
    approve.mockRejectedValueOnce(new Error('Network Error'));
    const user = await openPage();

    await user.click(screen.getByRole('button', { name: 'Approve Sông quê' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Approve "Sông quê"?' })).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' })).toBeEnabled());
    expect(screen.getByRole('dialog', { name: 'Approve "Sông quê"?' })).toBeInTheDocument();
  });

  it('asks again every minute while the page stays open, so new requests show up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      answerQueue([waitingA]);
      renderPage();
      expect(await screen.findByText('1 waiting')).toBeInTheDocument();

      answerQueue();
      await vi.advanceTimersByTimeAsync(REVIEW_QUEUE_REFRESH_MS);

      expect(await screen.findByText('2 waiting')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
