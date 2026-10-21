import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminThemesPage } from './AdminThemesPage';

const listThemes = vi.fn();
const createTheme = vi.fn();
const updateTheme = vi.fn();
const deleteTheme = vi.fn();

vi.mock('../api/admin.api', () => ({
  adminApi: {
    listThemes: (params: unknown) => listThemes(params),
    createTheme: (input: unknown) => createTheme(input),
    updateTheme: (id: string, input: unknown) => updateTheme(id, input),
    deleteTheme: (id: string) => deleteTheme(id),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const darkColors = { background: '#0b1020', text: '#e6ebff', muted: '#8f9bc9', accent: '#6d8bff' };
const lightColors = { background: '#fbf8f1', text: '#26231f', muted: '#6b655a', accent: '#1f6f78' };

const theme = (id: string, name: string, isDark = true) => ({
  _id: id,
  name,
  colors: isDark ? darkColors : lightColors,
  isDark,
  ownerName: 'TypeTrace',
  published: true,
});

const midnight = theme('t1', 'Midnight');
const paper = theme('t2', 'Paper', false);

const page = (items: unknown[]) => ({ items, page: 1, limit: 15, total: items.length, totalPages: 1 });

const renderPage = (route = '/admin/themes') => renderWithProviders(<AdminThemesPage />, { route, path: '/admin/themes' });

beforeEach(() => {
  tokenStore.set('jwt-value');
  listThemes.mockReset().mockResolvedValue(page([midnight, paper]));
  createTheme.mockReset();
  updateTheme.mockReset();
  deleteTheme.mockReset();
});

const pickColor = (label: string, color: string) =>
  fireEvent.change(screen.getByLabelText(`${label} picker`), { target: { value: color } });

describe('AdminThemesPage', () => {
  it('shows the New theme panel and the Themes panel with 15 themes per page', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'New theme' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Themes' })).toBeInTheDocument();
    const grid = await screen.findByLabelText('Themes', { selector: 'ul' });
    expect(within(grid).getByText('Midnight')).toBeInTheDocument();
    expect(within(grid).getByText('Paper')).toBeInTheDocument();
    expect(screen.getByText('2 themes in total')).toBeInTheDocument();
    expect(listThemes).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 15, sort: '-createdAt' }));
  });

  it('creates a theme for the chosen mode', async () => {
    createTheme.mockResolvedValue(midnight);
    renderPage();
    await screen.findByLabelText('Themes', { selector: 'ul' });

    // Dark is the first mode, with the Blood red colors to start from.
    expect(screen.getByRole('button', { name: 'Mode: Dark' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Night' } });
    pickColor('Accent', '#ff8844');
    fireEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    await waitFor(() => expect(createTheme).toHaveBeenCalled());
    expect(createTheme.mock.calls[0][0]).toMatchObject({ name: 'Night', mode: 'dark', colors: { accent: '#ff8844' } });
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
  });

  it('starts from the Sand colors in Light mode and refuses a background that does not fit the mode', async () => {
    renderPage();
    await screen.findByLabelText('Themes', { selector: 'ul' });

    fireEvent.click(screen.getByRole('button', { name: 'Mode: Dark' }));
    expect(screen.getByRole('button', { name: 'Mode: Light' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Day' } });
    pickColor('Background', '#101018');
    fireEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    expect(await screen.findByText(/too dark for Light mode/)).toBeInTheDocument();
    expect(createTheme).not.toHaveBeenCalled();
  });

  it('edits a theme from the list in the same panel, with the mode locked', async () => {
    updateTheme.mockResolvedValue(midnight);
    renderPage();

    const grid = await screen.findByLabelText('Themes', { selector: 'ul' });
    fireEvent.click(within(grid).getByRole('button', { name: 'Edit Midnight' }));

    expect(screen.getByRole('heading', { name: 'Edit theme' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Midnight');
    expect(screen.queryByRole('button', { name: /^Mode:/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Midnight 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    await waitFor(() => expect(updateTheme).toHaveBeenCalled());
    expect(updateTheme.mock.calls[0][0]).toBe('t1');
    expect(updateTheme.mock.calls[0][1]).toMatchObject({ name: 'Midnight 2', colors: darkColors });
    expect(await screen.findByRole('heading', { name: 'New theme' })).toBeInTheDocument();
  });

  it('goes back to a new theme when the edit is cancelled', async () => {
    renderPage();
    const grid = await screen.findByLabelText('Themes', { selector: 'ul' });

    fireEvent.click(within(grid).getByRole('button', { name: 'Edit Paper' }));
    expect(screen.getByRole('heading', { name: 'Edit theme' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { name: 'New theme' })).toBeInTheDocument();
  });

  it('deletes a theme after confirmation', async () => {
    deleteTheme.mockResolvedValue(undefined);
    renderPage();

    const grid = await screen.findByLabelText('Themes', { selector: 'ul' });
    fireEvent.click(within(grid).getByRole('button', { name: 'Delete Paper' }));
    const dialog = await screen.findByRole('dialog');
    expect(deleteTheme).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteTheme).toHaveBeenCalled());
    expect(deleteTheme.mock.calls[0][0]).toBe('t2');
  });

  it('applies the search, mode filter and sort from the URL', async () => {
    renderPage('/admin/themes?q=mid&isDark=true&sort=name');
    await screen.findByLabelText('Themes', { selector: 'ul' });

    expect(listThemes).toHaveBeenCalledWith(expect.objectContaining({ q: 'mid', isDark: 'true', sort: 'name' }));
  });

  it('filters by mode and sorts from the toolbar', async () => {
    renderPage();
    await screen.findByLabelText('Themes', { selector: 'ul' });

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Mode' })).getByRole('menuitemradio', { name: 'Light' }));
    await waitFor(() => expect(listThemes).toHaveBeenLastCalledWith(expect.objectContaining({ isDark: 'false' })));

    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Name Z–A' }));
    await waitFor(() => expect(listThemes).toHaveBeenLastCalledWith(expect.objectContaining({ sort: '-name' })));
  });

  it('pages through the themes', async () => {
    listThemes.mockResolvedValue({ items: [midnight, paper], page: 1, limit: 15, total: 31, totalPages: 3 });
    renderPage();
    await screen.findByLabelText('Themes', { selector: 'ul' });
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(listThemes).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 15 })));
  });

  it('shows an empty state for a search without results', async () => {
    listThemes.mockResolvedValue(page([]));
    renderPage('/admin/themes?q=nothing');

    expect(await screen.findByText('No matching themes')).toBeInTheDocument();
  });
});
