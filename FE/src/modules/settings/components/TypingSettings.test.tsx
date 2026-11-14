import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FONT_OPTIONS } from '../lib/fonts';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { TypingSettings } from './TypingSettings';

const getMe = vi.fn();
const updateSettings = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));
vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { updateSettings: (data: unknown) => updateSettings(data) },
}));

const user = (settings: object) => ({ _id: 'user-1', email: 'alice@example.com', role: 'user', settings });

beforeEach(() => {
  for (const option of FONT_OPTIONS) vi.spyOn(option, 'load').mockResolvedValue(undefined);
  tokenStore.set('jwt-value');
  getMe.mockReset();
  updateSettings.mockReset();
});

describe('TypingSettings', () => {
  it('shows the saved size and a preview at that size', async () => {
    getMe.mockResolvedValue(user({ typingFontSizeRem: 1.5 }));
    renderWithProviders(<TypingSettings />);

    const slider = await screen.findByRole('slider', { name: 'Font size' });
    expect(slider).toHaveValue('1.5');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '2.5');
    expect(slider).toHaveAttribute('step', '0.125');
    // The size in rem, and in px beside it (1.5 rem of a 16px root).
    expect(screen.getByText('1.5 rem · 24 px')).toBeInTheDocument();
    expect(screen.getByLabelText('Passage to type').style.fontSize).toBe('1.5rem');
  });

  it('has the sample passage on top, then the Font and Font size panels', async () => {
    getMe.mockResolvedValue(user({}));
    renderWithProviders(<TypingSettings />);

    const passage = await screen.findByLabelText('Passage to type');
    const previewTitle = screen.getByRole('heading', { name: 'Preview' });
    const fontTitle = screen.getByRole('heading', { name: 'Font' });
    const sizeTitle = screen.getByRole('heading', { name: 'Font size' });
    expect(screen.getByRole('radiogroup', { name: 'Interface font' })).toBeInTheDocument();
    expect(previewTitle.compareDocumentPosition(passage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(passage.compareDocumentPosition(fontTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fontTitle.compareDocumentPosition(sizeTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws the sample like the typing page: a wrong word in red and a caret in the word being typed', async () => {
    getMe.mockResolvedValue(user({}));
    const { container } = renderWithProviders(<TypingSettings />);

    const passage = await screen.findByLabelText('Passage to type');
    expect(passage.querySelector('.text-destructive.underline')).not.toBeNull();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('has no frame around the preview and fills the bar up to the size', async () => {
    getMe.mockResolvedValue(user({ typingFontSizeRem: 1.75 }));
    renderWithProviders(<TypingSettings />);

    await screen.findByRole('slider', { name: 'Font size' });
    expect(screen.getByLabelText('Passage to type').parentElement!.className).not.toMatch(/border/);
    // (1.75 - 1) / (2.5 - 1) = 50 % of the bar.
    expect(screen.getByTestId('font-size-fill').style.width).toBe('50%');
  });

  it('starts at 2 rem for an account that never chose a size', async () => {
    getMe.mockResolvedValue(user({}));
    renderWithProviders(<TypingSettings />);

    expect(await screen.findByRole('slider', { name: 'Font size' })).toHaveValue('2');
  });

  it('moves the preview while dragging and saves the size on release', async () => {
    getMe.mockResolvedValue(user({ typingFontSizeRem: 2 }));
    updateSettings.mockResolvedValue(user({ typingFontSizeRem: 2.25 }));
    renderWithProviders(<TypingSettings />);
    const slider = await screen.findByRole('slider', { name: 'Font size' });

    fireEvent.change(slider, { target: { value: '2.25' } });

    expect(screen.getByLabelText('Passage to type').style.fontSize).toBe('2.25rem');
    expect(screen.getByText('2.25 rem · 36 px')).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ typingFontSizeRem: 2.25 }));
  });

  it('keeps the new size on the slider while the save is on its way', async () => {
    getMe.mockResolvedValue(user({ typingFontSizeRem: 2 }));
    updateSettings.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<TypingSettings />);
    const slider = await screen.findByRole('slider', { name: 'Font size' });

    fireEvent.change(slider, { target: { value: '1.25' } });
    fireEvent.pointerUp(slider);

    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(slider).toHaveValue('1.25');
    expect(screen.getByLabelText('Passage to type').style.fontSize).toBe('1.25rem');
  });

  it('goes back to the default size with the reset button, which is off at the default', async () => {
    getMe.mockResolvedValue(user({ typingFontSizeRem: 1.5 }));
    updateSettings.mockResolvedValue(user({ typingFontSizeRem: 2 }));
    renderWithProviders(<TypingSettings />);

    const reset = await screen.findByRole('button', { name: 'Reset font size' });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ typingFontSizeRem: 2 }));
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Font size' })).toHaveValue('2'));
    expect(screen.getByRole('button', { name: 'Reset font size' })).toBeDisabled();
  });

  it('does not save when the size was not changed', async () => {
    getMe.mockResolvedValue(user({ typingFontSizeRem: 2 }));
    renderWithProviders(<TypingSettings />);

    fireEvent.pointerUp(await screen.findByRole('slider', { name: 'Font size' }));

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('shows the loading state while the user loads', () => {
    getMe.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<TypingSettings />);

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows the error state when the user fails to load', async () => {
    getMe.mockRejectedValue({ response: { data: { message: 'Server down' } } });
    renderWithProviders(<TypingSettings />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
  });
});
