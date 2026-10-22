import userEvent from '@testing-library/user-event';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('../api/passages.api', () => ({
  passagesApi: { list: (params: unknown) => list(params), create: (input: unknown) => create(input),
    update: (id: string, input: unknown) => update(id, input),
    setStatus: (id: string, status: unknown) => setStatus(id, status),
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

const renderPage = () => renderWithProviders(<AdminPassagesPage />, { route: '/admin/passages' });

beforeEach(() => {
  list.mockReset().mockResolvedValue(page([passage]));
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
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 9 }));
  });

  it('shows an empty state without any example card', async () => {
    list.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('No passages yet')).toBeInTheDocument();
    expect(screen.queryByText('Phố cổ buổi sớm')).not.toBeInTheDocument();
  });

  it('shows the backend error with a retry button', async () => {
    list.mockRejectedValue({ response: { status: 500, data: { message: 'Database offline' } } });
    renderPage();

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    list.mockResolvedValue(page([passage]));
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

  it('counts the words and can mark the passage as a placement passage', async () => {
    create.mockResolvedValue({ ...passage, _id: 'p3', isPlacement: true });
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Kiểm tra' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'TypeTrace' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'một hai ba' } });
    expect(screen.getByText('3 words · 10/5000')).toBeInTheDocument();

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
    list.mockResolvedValue(page([{ ...passage, status: 'published' }]));
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');

    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /status/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
  });

  it('shows the status of the passage in the edit form', async () => {
    list.mockResolvedValue(page([{ ...passage, status: 'published' }]));
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
    expect(screen.getByRole('button', { name: 'Status: draft' })).toHaveClass('bg-muted');
    expect(setStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Status: draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update passage' }));

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('p1', 'published'));
    expect(update).toHaveBeenCalled();
  });

  it('moves an archived passage to published', async () => {
    list.mockResolvedValue(page([{ ...passage, status: 'archived' }]));
    renderPage();
    await screen.findByText('Mùa thu Hà Nội');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mùa thu Hà Nội' }));

    fireEvent.click(screen.getByRole('button', { name: 'Status: archived' }));

    expect(screen.getByRole('button', { name: 'Status: published' })).toBeInTheDocument();
  });

  it('lets an admin archive a placement passage with the status button', async () => {
    list.mockResolvedValue(page([{ ...passage, status: 'published', isPlacement: true }]));
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

describe('AdminPassagesPage: Pending review tab (SCRUM-176)', () => {
  const waitingA = {
    ...passage,
    _id: 'pA',
    title: 'Sông quê',
    content: 'Dòng sông quê hương hiền hòa chảy qua làng.',
    ownerName: 'Lan',
    status: 'pending',
    visibility: 'private',
    wordCount: 21,
    updatedAt: '2026-10-20T12:00:00.000Z',
  };
  const waitingB = { ...waitingA, _id: 'pB', title: 'Biển xanh', ownerName: 'Minh', updatedAt: '2026-10-21T12:00:00.000Z' };

  /** The bank asks without a status; the tab count asks for `status: 'pending', limit: 1`, the table for its page. */
  const answerQueue = (items: unknown[] = [waitingA, waitingB]) =>
    list.mockImplementation(async (params: { status?: string; limit?: number }) => {
      if (params.status !== 'pending') return page([passage]);
      return { items: params.limit === 1 ? items.slice(0, 1) : items, page: 1, limit: params.limit, total: items.length, totalPages: 1 };
    });

  const openTab = async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPassagesPage />, { route: '/admin/passages?tab=pending' });
    await within(await screen.findByRole('table', { name: 'Passages waiting for review' })).findByText('Sông quê');
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

  it('shows on its tab how many requests wait, and lists them in a table, oldest first', async () => {
    const user = userEvent.setup();
    renderPage();

    const tab = await screen.findByRole('tab', { name: /Pending review/ });
    await waitFor(() => expect(tab).toHaveTextContent(/Pending review\s*2/));
    expect(screen.getByRole('tab', { name: 'All passages' })).toHaveAttribute('aria-selected', 'true');
    await user.click(tab);

    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Pending review' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'New passage' })).not.toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Passages waiting for review' });
    expect(await within(table).findByText('Sông quê')).toBeInTheDocument();
    expect(within(table).getByText('Lan')).toBeInTheDocument();
    expect(within(table).getByText('20 Oct 2026')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ status: 'pending', page: 1, limit: 10, sort: 'updatedAt', q: undefined });
    expect(screen.getByText('2 waiting')).toBeInTheDocument();
  });

  it('searches the requests', async () => {
    const user = await openTab();

    await user.type(screen.getByLabelText('Search requests'), 'biển{Enter}');

    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', q: 'biển', page: 1 })));
  });

  it('shows an empty state when no request waits, and no number on the tab', async () => {
    answerQueue([]);
    renderWithProviders(<AdminPassagesPage />, { route: '/admin/passages?tab=pending' });

    expect(await screen.findByText('Nothing to review')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pending review' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens a request to read its whole text, and approves it from there after a confirmation', async () => {
    approve.mockResolvedValue({ ...waitingA, status: 'published', visibility: 'public' });
    const user = await openTab();

    await user.click(screen.getByRole('button', { name: 'View Sông quê' }));
    const view = await screen.findByRole('dialog', { name: 'Sông quê' });
    expect(within(view).getByText('Dòng sông quê hương hiền hòa chảy qua làng.')).toBeInTheDocument();
    expect(within(view).getByText('by Lan · 21 words')).toBeInTheDocument();
    await user.click(within(view).getByRole('button', { name: 'Approve' }));

    const confirm = await screen.findByRole('dialog', { name: 'Approve "Sông quê"?' });
    expect(approve).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approve).toHaveBeenCalledWith('pA'));
    expect(toast.success).toHaveBeenCalledWith('Passage approved.');
  });

  it('turns a request down only with a reason, which is sent', async () => {
    reject.mockResolvedValue({ ...waitingA, status: 'published', reviewNote: 'Trùng nội dung' });
    const user = await openTab();

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
    expect(toast.success).toHaveBeenCalledWith('Passage turned down.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('approves or turns down the selected requests at once', async () => {
    bulkApprove.mockResolvedValue({ updated: 2 });
    bulkReject.mockResolvedValue({ updated: 1 });
    const user = await openTab();
    expect(screen.queryByRole('button', { name: 'Approve 2' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    await user.click(screen.getByRole('button', { name: 'Approve 2' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Approve 2 passages?' })).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(bulkApprove).toHaveBeenCalledWith(['pA', 'pB']));
    expect(toast.success).toHaveBeenCalledWith('2 passages approved.');
    // A decision clears the selection.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve 2' })).not.toBeInTheDocument());

    await user.click(screen.getByRole('checkbox', { name: 'Select row pA' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select row pB' }));
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
      const user = await openTab();
      answerQueue([waitingB]);

      await user.click(screen.getByRole('button', { name: 'Approve Sông quê' }));
      await user.click(within(await screen.findByRole('dialog', { name: 'Approve "Sông quê"?' })).getByRole('button', { name: 'Approve' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(await screen.findByText('1 waiting')).toBeInTheDocument();
      expect(screen.queryByText('Sông quê')).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Pending review/ })).toHaveTextContent(/Pending review\s*1/);
      cleanup();
    }
  });

  it('keeps the dialog open to try again when the server cannot be reached', async () => {
    approve.mockRejectedValueOnce(new Error('Network Error'));
    const user = await openTab();

    await user.click(screen.getByRole('button', { name: 'Approve Sông quê' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Approve "Sông quê"?' })).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' })).toBeEnabled());
    expect(screen.getByRole('dialog', { name: 'Approve "Sông quê"?' })).toBeInTheDocument();
  });

  it('asks again for the number on the tab when the tab is opened, so it matches the queue', async () => {
    answerQueue([]);
    const user = userEvent.setup();
    renderPage();
    const tab = await screen.findByRole('tab', { name: /Pending review/ });
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', limit: 1 })));
    expect(tab).toHaveTextContent(/^Pending review$/);

    // Two learners send a request while the admin is on the other tab.
    answerQueue();
    await user.click(tab);

    expect(await screen.findByText('2 waiting')).toBeInTheDocument();
    await waitFor(() => expect(tab).toHaveTextContent(/Pending review\s*2/));
  });

  it('asks again every minute while the page stays open, so new requests show up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      answerQueue([waitingA]);
      renderWithProviders(<AdminPassagesPage />, { route: '/admin/passages?tab=pending' });
      expect(await screen.findByText('1 waiting')).toBeInTheDocument();

      answerQueue();
      await vi.advanceTimersByTimeAsync(REVIEW_QUEUE_REFRESH_MS);

      expect(await screen.findByText('2 waiting')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('tab', { name: /Pending review/ })).toHaveTextContent(/Pending review\s*2/));
    } finally {
      vi.useRealTimers();
    }
  });
});
