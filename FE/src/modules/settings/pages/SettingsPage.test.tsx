import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { themesApi } from '../api/themes.api';
import { useThemeSync } from '../hooks/use-theme-mode';
import { themeDraftStore } from '../store/theme-draft.store';
import type { ActiveThemes, Theme } from '../types/theme.types';
import { SettingsPage } from './SettingsPage';

vi.mock('../api/themes.api', () => ({
  themesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), getActive: vi.fn(), updateActive: vi.fn() },
}));

const api = vi.mocked(themesApi);

const make = (id: string, name: string, isDark: boolean, published: boolean, accent: string): Theme => ({
  _id: id,
  name,
  isDark,
  published,
  ownerName: published ? 'TypeTrace' : 'Alice',
  colors: isDark
    ? { background: '#0b1020', text: '#e6ebff', muted: '#8f9bc9', accent }
    : { background: '#ffffff', text: '#111111', muted: '#777777', accent },
});

const midnight = make('t1', 'Midnight', true, true, '#6d8bff');
const night = make('t2', 'Night', true, false, '#44ccaa');
const mono = make('t3', 'Mono', false, true, '#555555');
const paper = make('t4', 'Paper', false, false, '#1f6f78');

let active: ActiveThemes;
let themes: Theme[];

// Like a layout: it paints the chosen theme, or the unsaved one while it is being made.
const Layout = () => {
  useThemeSync();
  return <SettingsPage />;
};

const renderPage = () => renderWithProviders(<Layout />, { route: '/settings', path: '/settings' });

const card = (name: string) => screen.getByRole('button', { name: new RegExp(`Button ${name}$`) });
const isChosen = (name: string) => card(name).querySelector('[aria-current]') !== null;

beforeEach(() => {
  themeDraftStore.clear();
  tokenStore.set('jwt-value');
  active = { mode: 'dark', dark: null, light: null };
  themes = [midnight, mono, night, paper];
  vi.resetAllMocks();
  api.getActive.mockImplementation(async () => active);
  api.list.mockImplementation(async (isDark) => themes.filter((theme) => theme.isDark === isDark));
  // Like the server: keeps what was sent.
  api.updateActive.mockImplementation(async (input) => {
    const find = (id: string | null | undefined) => themes.find((theme) => theme._id === id) ?? null;
    if (input.mode) active = { ...active, mode: input.mode };
    if (input.darkTheme !== undefined) active = { ...active, dark: find(input.darkTheme) };
    if (input.lightTheme !== undefined) active = { ...active, light: find(input.lightTheme) };
    return active;
  });
});

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.documentElement.classList.remove('dark');
});

describe('SettingsPage', () => {
  it('shows the Appearance panel with the themes of the mode in use', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    // One list: the fallback, TypeTrace's themes, the user's own, then the add card.
    const list = screen.getByRole('list', { name: 'Themes' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Blood red'),
      expect.stringContaining('Midnight'),
      expect.stringContaining('Night'),
      'Custom theme',
    ]);
    expect(screen.queryByText('Mono')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom theme' })).toBeInTheDocument();
  });

  it('marks the fallback as chosen when no theme is, and only one card at a time', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    expect(isChosen('Blood red')).toBe(true);
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
  });

  it('marks the theme chosen for the mode', async () => {
    active = { mode: 'dark', dark: night, light: null };
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    expect(isChosen('Night')).toBe(true);
    expect(isChosen('Blood red')).toBe(false);
  });

  it('chooses a theme for the mode and goes back to the fallback', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    await userEvent.click(card('Midnight'));
    expect(api.updateActive).toHaveBeenCalledWith({ darkTheme: 't1' });
    await waitFor(() => expect(isChosen('Midnight')).toBe(true));

    await userEvent.click(card('Blood red'));
    expect(api.updateActive).toHaveBeenLastCalledWith({ darkTheme: null });
  });

  it('shows the light themes and the Sand fallback after the Light tab, and keeps the theme of each mode', async () => {
    active = { mode: 'dark', dark: night, light: paper };
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));

    expect(api.updateActive).toHaveBeenCalledWith({ mode: 'light' });
    expect(await screen.findByRole('button', { name: /Button Sand$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Button Mono$/ })).toBeInTheDocument();
    expect(screen.queryByText('Midnight')).not.toBeInTheDocument();
    expect(isChosen('Paper')).toBe(true);
  });

  it('shows a loading state, then the error with a way to try again', async () => {
    api.list.mockRejectedValueOnce(new Error('down')).mockImplementation(async (isDark) => themes.filter((theme) => theme.isDark === isDark));
    renderPage();
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
  });
});

describe('adding a theme', () => {
  const openEditor = async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Custom theme' }));
    return screen.getByRole('form', { name: 'New theme' });
  };

  it('saves the name and colors, then chooses the new theme for the mode', async () => {
    const created = make('t9', 'Ocean', true, false, '#00aaff');
    api.create.mockResolvedValue(created);
    await openEditor();

    await userEvent.type(screen.getByLabelText('Name'), '  Ocean ');
    fireEvent.change(screen.getByLabelText('Accent picker'), { target: { value: '#00aaff' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    expect(api.create.mock.calls[0][0]).toEqual({
      name: 'Ocean',
      colors: { background: '#140606', text: '#e6d2d2', muted: '#a87878', accent: '#00aaff' },
    });
    await waitFor(() => expect(api.updateActive).toHaveBeenCalledWith({ darkTheme: 't9' }));
    expect(screen.queryByRole('form', { name: 'New theme' })).not.toBeInTheDocument();
  });

  it('shows the colors on the page while editing and puts the theme in use back on cancel', async () => {
    await openEditor();

    fireEvent.change(screen.getByLabelText('Accent picker'), { target: { value: '#00aaff' } });
    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('#00aaff');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('');
    expect(screen.queryByRole('form', { name: 'New theme' })).not.toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('keeps an unsaved theme when the page is left and opened again, and drops it on logout', async () => {
    const first = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Custom theme' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Draft');
    fireEvent.change(screen.getByLabelText('Accent picker'), { target: { value: '#00aaff' } });
    first.unmount();

    // The colors stay on every page.
    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('#00aaff');
    renderPage();
    expect(await screen.findByLabelText('Name')).toHaveValue('Draft');
    expect(screen.getByLabelText('Accent picker')).toHaveValue('#00aaff');

    themeDraftStore.clear();
    await waitFor(() => expect(screen.queryByRole('form', { name: 'New theme' })).not.toBeInTheDocument());
    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('');
  });

  it('keeps an unsaved edit of a theme too', async () => {
    const first = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Night' }));
    await userEvent.type(screen.getByLabelText('Name'), ' 2');
    first.unmount();

    renderPage();
    expect(await screen.findByRole('form', { name: 'Edit theme' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Night 2');
  });

  it('closes the editor when the mode changes', async () => {
    await openEditor();

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'New theme' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Custom theme' })).toBeInTheDocument();
  });

  it('rejects an empty name and a name the user already has, ignoring case', async () => {
    await openEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }));
    expect(await screen.findByText('Theme name is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'NIGHT');
    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }));
    expect(await screen.findByText('You already have a theme with this name')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('rejects colors that are hard to read, naming the color', async () => {
    await openEditor();
    await userEvent.type(screen.getByLabelText('Name'), 'Murky');

    fireEvent.change(screen.getByLabelText('Text picker'), { target: { value: '#2a1010' } });
    expect(await screen.findByText(/Text is hard to read on this background/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    expect(api.create).not.toHaveBeenCalled();
  });

  it('rejects a background that does not fit the mode', async () => {
    await openEditor();
    await userEvent.type(screen.getByLabelText('Name'), 'Bright');

    fireEvent.change(screen.getByLabelText('Background picker'), { target: { value: '#ffffff' } });
    expect(await screen.findByText('The background is too light for Dark mode.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    expect(api.create).not.toHaveBeenCalled();
  });

  it('disables the add card when the user has 9 themes', async () => {
    themes = [midnight, ...Array.from({ length: 9 }, (_, i) => make(`m${i}`, `Mine ${i}`, true, false, '#44ccaa'))];
    renderPage();

    expect(await screen.findByRole('button', { name: 'Custom theme' })).toBeDisabled();
  });
});

describe('editing a theme', () => {
  const edit = async (name: string) => {
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });
    await userEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
    return screen.getByRole('form', { name: 'Edit theme' });
  };

  it('opens the theme in place of its card, with its name and colors', async () => {
    await edit('Night');

    expect(screen.getByLabelText('Name')).toHaveValue('Night');
    expect(screen.getByLabelText('Accent picker')).toHaveValue('#44ccaa');
    expect(screen.queryByRole('button', { name: /Button Night$/ })).not.toBeInTheDocument();
    // The add card is still the last card.
    expect(screen.getByRole('button', { name: 'Custom theme' })).toBeInTheDocument();
  });

  it('saves the new name and colors', async () => {
    api.update.mockResolvedValue(night);
    await edit('Night');

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Dusk');
    fireEvent.change(screen.getByLabelText('Accent picker'), { target: { value: '#ff8800' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    expect(api.update.mock.calls[0]).toEqual(['t2', { name: 'Dusk', colors: { ...night.colors, accent: '#ff8800' } }]);
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit theme' })).not.toBeInTheDocument());
  });

  it('lets a theme keep its own name', async () => {
    api.update.mockResolvedValue(night);
    await edit('Night');

    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    await waitFor(() => expect(api.update).toHaveBeenCalled());
  });

  it('puts the theme in use back on cancel', async () => {
    await edit('Night');
    fireEvent.change(screen.getByLabelText('Accent picker'), { target: { value: '#ff8800' } });
    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('#ff8800');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('');
    expect(screen.getByRole('button', { name: /Button Night$/ })).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('is only offered on the user’s own themes', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    expect(screen.queryByRole('button', { name: 'Edit Midnight' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Blood red' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Night' })).toBeInTheDocument();
  });

  it('sits between the delete button and the chosen tag', async () => {
    active = { mode: 'dark', dark: night, light: null };
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    // From the right: the check at right-2, then Edit, then Delete.
    expect(screen.getByRole('button', { name: 'Edit Night' })).toHaveClass('right-9');
    expect(screen.getByRole('button', { name: 'Delete Night' })).toHaveClass('right-16');
  });
});

describe('deleting a theme', () => {
  it('asks first, then deletes the theme', async () => {
    api.remove.mockResolvedValue(undefined);
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    await userEvent.click(screen.getByRole('button', { name: 'Delete Night' }));
    expect(screen.getByText('Delete this theme?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.remove).toHaveBeenCalled());
    expect(api.remove.mock.calls[0][0]).toBe('t2');
  });

  it('warns that the fallback comes back when the theme in use is deleted', async () => {
    active = { mode: 'dark', dark: night, light: null };
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    await userEvent.click(screen.getByRole('button', { name: 'Delete Night' }));

    expect(screen.getByText(/You will go back to Blood red/)).toBeInTheDocument();
  });

  it('has no delete button on TypeTrace themes or the fallback', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Appearance' });

    expect(screen.queryByRole('button', { name: 'Delete Midnight' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Blood red' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Night' })).toBeInTheDocument();
  });
});
