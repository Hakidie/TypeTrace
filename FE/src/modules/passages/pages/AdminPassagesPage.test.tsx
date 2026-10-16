import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminPassagesPage } from './AdminPassagesPage';

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const setStatus = vi.fn();

vi.mock('../api/passages.api', () => ({
  passagesApi: { list: (params: unknown) => list(params), create: (input: unknown) => create(input),
    update: (id: string, input: unknown) => update(id, input),
    setStatus: (id: string, status: unknown) => setStatus(id, status),
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

  it('always shows an example card', async () => {
    list.mockResolvedValue(page([]));
    renderPage();

    expect(screen.getByText('Phố cổ buổi sớm')).toBeInTheDocument();
    expect(screen.getByText('Placement')).toBeInTheDocument();
    expect(await screen.findByText('No passages yet')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    list.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('No passages yet')).toBeInTheDocument();
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

    // The example card and the passage of the list both show `published`.
    expect(screen.getAllByText('published')).toHaveLength(2);
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
