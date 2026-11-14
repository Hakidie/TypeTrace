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

const getMe = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

const resetTutorial = vi.fn();
vi.mock('@/modules/tutorial/api/tutorial.api', () => ({
  tutorialApi: { start: vi.fn(), update: vi.fn(), reset: () => resetTutorial(), coach: vi.fn() },
}));

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

const renderPage = (tab?: string) => renderWithProviders(<Layout />, { route: tab ? `/settings?tab=${tab}` : '/settings', path: '/settings' });

const card = (name: string) => screen.getByRole('button', { name: new RegExp(`Button ${name}$`) });
const isChosen = (name: string) => card(name).querySelector('[aria-current]') !== null;

beforeEach(() => {
  themeDraftStore.clear();
  tokenStore.set('jwt-value');
  active = { mode: 'dark', dark: null, light: null };
  themes = [midnight, mono, night, paper];
  vi.resetAllMocks();
  getMe.mockResolvedValue({
    _id: 'user-1',
    email: 'alice@example.com',
    role: 'user',
    isEmailVerified: true,
    loginOtpEnabled: false,
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
  });
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

    expect(await screen.findByRole('heading', { name: 'Themes' })).toBeInTheDocument();
    // One list: the fallback, TypeTrace's themes, then the user's own.
    const list = screen.getByRole('list', { name: 'Themes' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Blood red'),
      expect.stringContaining('Midnight'),
      expect.stringContaining('Night'),
    ]);
    expect(screen.queryByText('Mono')).not.toBeInTheDocument();
    // The editor for a new theme is above the list.
    expect(screen.getByRole('form', { name: 'New theme' })).toBeInTheDocument();
  });

  it('chooses the version of the wardrobe in the Wardrobe tab and remembers it', async () => {
    renderPage('wardrobe');

    const versions = await screen.findByRole('radiogroup', { name: 'Wardrobe version' });
    expect(within(versions).getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(versions).getByRole('radio', { name: 'Modern' }));

    expect(within(versions).getByRole('radio', { name: 'Modern' })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('wardrobeVersion')).toBe('modern');
  });

  it("replays Ping's tutorial from the Tutorial panel", async () => {
    resetTutorial.mockResolvedValue({ _id: 'u1', email: 'lan@example.com', role: 'user', tutorial: { tour: 'active', modes: {} } });
    renderPage('tutorial');

    fireEvent.click(await screen.findByRole('button', { name: 'Replay tutorial' }));

    await waitFor(() => expect(resetTutorial).toHaveBeenCalledOnce());
  });

  it('has a Typing tab with the Font and Font size panels', async () => {
    renderPage('typing');

    expect(await screen.findByRole('radiogroup', { name: 'Interface font' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Font size' })).toBeInTheDocument();
  });

  it('has no Font tab of its own: its panel is in the Typing tab', async () => {
    renderPage('font');

    // An unknown tab falls back to Appearance (its theme form).
    expect(await screen.findByRole('form', { name: 'New theme' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Interface font' })).not.toBeInTheDocument();
  });

  it('has a Security panel with the email code at login switch', async () => {
    renderPage('security');

    const toggle = await screen.findByRole('switch', { name: 'Email code at login' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });


  it('lists the tabs in order: Typing, Appearance, Wardrobe, Security, Tutorial', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    const tabs = within(screen.getByRole('radiogroup', { name: 'Settings' })).getAllByRole('radio');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Typing', 'Appearance', 'Wardrobe', 'Security', 'Tutorial']);
  });

  it('shows one setting at a time, chosen with the tabs', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });
    expect(screen.queryByRole('switch', { name: 'Email code at login' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Security' }));
    expect(await screen.findByRole('switch', { name: 'Email code at login' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Themes' })).not.toBeInTheDocument();
  });

  it('shows 6 themes a page, in 3 columns', async () => {
    themes = [midnight, ...Array.from({ length: 6 }, (_, i) => make(`m${i}`, `Mine ${i}`, true, false, '#44ccaa'))];
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    const list = screen.getByRole('list', { name: 'Themes' });
    expect(list).toHaveClass('grid-cols-3');
    // The fallback, Midnight and 4 of the user's 6; the other 2 are on page 2.
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.queryByText('Mine 5')).not.toBeInTheDocument();
  });

  it('puts the page in the mode of a theme picked after the Mode filter', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Mode' })).getByRole('menuitemradio', { name: 'Light' }));
    // Picking the filter alone changes nothing.
    expect(api.updateActive).not.toHaveBeenCalled();

    await userEvent.click(card('Mono'));

    await waitFor(() => expect(api.updateActive).toHaveBeenCalledWith({ mode: 'light', lightTheme: 't3' }));
    expect(await screen.findByRole('button', { name: 'Mode: Dark' })).toBeInTheDocument();
  });

  it('sorts the themes by name and filters them by source', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });
    const names = () => within(screen.getByRole('list', { name: 'Themes' })).getAllByRole('listitem').map((item) => item.textContent);

    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Name Z–A' }));
    expect(names()).toEqual([expect.stringContaining('Night'), expect.stringContaining('Midnight'), expect.stringContaining('Blood red')]);

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Source' })).getByRole('menuitemradio', { name: 'Mine' }));
    expect(names()).toEqual([expect.stringContaining('Night')]);
  });

  it('filters by mode (the page mode at first) and by System', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });
    const names = () => within(screen.getByRole('list', { name: 'Themes' })).getAllByRole('listitem').map((item) => item.textContent);
    const pick = (group: string, option: string) => {
      fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
      fireEvent.click(within(screen.getByRole('group', { name: group })).getByRole('menuitemradio', { name: option }));
    };

    pick('Mode', 'Light');
    expect(names()).toEqual([expect.stringContaining('Sand'), expect.stringContaining('Mono'), expect.stringContaining('Paper')]);

    pick('Mode', 'All');
    expect(names()).toHaveLength(6);

    pick('Source', 'System');
    expect(names()).toEqual([
      expect.stringContaining('Blood red'),
      expect.stringContaining('Midnight'),
      expect.stringContaining('Sand'),
      expect.stringContaining('Mono'),
    ]);
  });

  it('marks the fallback as chosen when no theme is, and only one card at a time', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    expect(isChosen('Blood red')).toBe(true);
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
  });

  it('marks the theme chosen for the mode', async () => {
    active = { mode: 'dark', dark: night, light: null };
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    expect(isChosen('Night')).toBe(true);
    expect(isChosen('Blood red')).toBe(false);
  });

  it('chooses a theme for the mode and goes back to the fallback', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    await userEvent.click(card('Midnight'));
    expect(api.updateActive).toHaveBeenCalledWith({ mode: 'dark', darkTheme: 't1' });
    await waitFor(() => expect(isChosen('Midnight')).toBe(true));

    await userEvent.click(card('Blood red'));
    expect(api.updateActive).toHaveBeenLastCalledWith({ mode: 'dark', darkTheme: null });
  });

  it('shows the light themes and the Sand fallback after the Light tab, and keeps the theme of each mode', async () => {
    active = { mode: 'dark', dark: night, light: paper };
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

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

    expect(await screen.findByRole('heading', { name: 'Themes' })).toBeInTheDocument();
  });
});

describe('adding a theme', () => {
  const openEditor = async () => {
    renderPage();
    const form = await screen.findByRole('form', { name: 'New theme' });
    // The form starts in the other mode than the page; the button makes it match.
    await userEvent.click(screen.getByRole('button', { name: 'Mode: Light' }));
    await screen.findByRole('button', { name: 'Mode: Dark' });
    return form;
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
      mode: 'dark',
    });
    await waitFor(() => expect(api.updateActive).toHaveBeenCalledWith({ darkTheme: 't9' }));
    // The editor starts again, empty.
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
  });

  it('shows the colors of a new theme on the page while editing', async () => {
    await openEditor();

    fireEvent.change(screen.getByLabelText('Accent picker'), { target: { value: '#00aaff' } });
    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('#00aaff');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('keeps an unsaved theme when the page is left and opened again, and drops it on logout', async () => {
    const first = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Mode: Light' }));
    await userEvent.type(await screen.findByLabelText('Name'), 'Draft');
    fireEvent.change(screen.getByLabelText('Accent picker'), { target: { value: '#00aaff' } });
    first.unmount();

    // The colors stay on every page.
    expect(document.documentElement.style.getPropertyValue('--theme-accent')).toBe('#00aaff');
    renderPage();
    expect(await screen.findByLabelText('Name')).toHaveValue('Draft');
    expect(screen.getByLabelText('Accent picker')).toHaveValue('#00aaff');

    themeDraftStore.clear();
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
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

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
    expect(screen.getByRole('form', { name: 'New theme' })).toBeInTheDocument();
  });

  it('starts in the other mode than the page, and its button switches only the form', async () => {
    const created = make('t9', 'Bright', false, false, '#1f6f78');
    api.create.mockResolvedValue(created);
    renderPage();

    // The page is in dark mode, so the form makes a light theme.
    expect(await screen.findByRole('button', { name: 'Mode: Light' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();

    await userEvent.type(screen.getByLabelText('Name'), 'Bright');
    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    expect(api.create.mock.calls[0][0]).toMatchObject({ name: 'Bright', mode: 'light' });
    // It is chosen for light mode, and the mode in use is not touched.
    await waitFor(() => expect(api.updateActive).toHaveBeenCalledWith({ lightTheme: 't9' }));
    expect(api.updateActive).not.toHaveBeenCalledWith(expect.objectContaining({ mode: expect.anything() }));

    await userEvent.click(await screen.findByRole('button', { name: 'Mode: Light' }));
    expect(await screen.findByRole('button', { name: 'Mode: Dark' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
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

  it('replaces the editor with a note when the user has 9 themes', async () => {
    themes = [midnight, ...Array.from({ length: 9 }, (_, i) => make(`m${i}`, `Mine ${i}`, true, false, '#44ccaa'))];
    renderPage();

    expect(await screen.findByText(/at most 9 themes/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'New theme' })).not.toBeInTheDocument();
  });
});

describe('editing a theme', () => {
  const edit = async (name: string) => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });
    await userEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
    return screen.getByRole('form', { name: 'Edit theme' });
  };

  it('opens the theme in the editor above the list, with its name and colors', async () => {
    await edit('Night');

    expect(screen.getByLabelText('Name')).toHaveValue('Night');
    expect(screen.getByLabelText('Accent picker')).toHaveValue('#44ccaa');
    expect(screen.getByRole('form', { name: 'Edit theme' })).toBeInTheDocument();
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
    await screen.findByRole('heading', { name: 'Themes' });

    expect(screen.queryByRole('button', { name: 'Edit Midnight' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Blood red' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Night' })).toBeInTheDocument();
  });

  it('sits between the delete button and the chosen tag', async () => {
    active = { mode: 'dark', dark: night, light: null };
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    // From the right: the check at right-2, then Edit, then Delete.
    expect(screen.getByRole('button', { name: 'Edit Night' })).toHaveClass('right-9');
    expect(screen.getByRole('button', { name: 'Delete Night' })).toHaveClass('right-16');
  });
});

describe('deleting a theme', () => {
  it('asks first, then deletes the theme', async () => {
    api.remove.mockResolvedValue(undefined);
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    await userEvent.click(screen.getByRole('button', { name: 'Delete Night' }));
    expect(screen.getByText('Delete this theme?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.remove).toHaveBeenCalled());
    expect(api.remove.mock.calls[0][0]).toBe('t2');
  });

  it('warns that the fallback comes back when the theme in use is deleted', async () => {
    active = { mode: 'dark', dark: night, light: null };
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    await userEvent.click(screen.getByRole('button', { name: 'Delete Night' }));

    expect(screen.getByText(/You will go back to Blood red/)).toBeInTheDocument();
  });

  it('has no delete button on TypeTrace themes or the fallback', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Themes' });

    expect(screen.queryByRole('button', { name: 'Delete Midnight' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Blood red' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Night' })).toBeInTheDocument();
  });
});
