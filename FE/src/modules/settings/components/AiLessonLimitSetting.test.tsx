import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AiLessonLimitSetting } from './AiLessonLimitSetting';

const getSettings = vi.fn();
const updateSettings = vi.fn();

vi.mock('../api/ai-settings.api', () => ({
  aiSettingsApi: {
    get: () => getSettings(),
    update: (settings: unknown) => updateSettings(settings),
  },
}));

const LABEL = 'AI passages per learner a day';
const MINUTE_LABEL = 'AI passages per learner a minute';

beforeEach(() => {
  tokenStore.set('test-token');
  getSettings.mockReset().mockResolvedValue({ lessonsPerDay: 20, lessonsPerMinute: 5 });
  updateSettings.mockReset().mockImplementation(async (settings: { lessonsPerDay: number }) => settings);
});

const renderSetting = () => renderWithProviders(<AiLessonLimitSetting />);

describe('AiLessonLimitSetting', () => {
  it('shows the daily limit in use, with Save off until it changes', async () => {
    renderSetting();

    expect(await screen.findByLabelText(LABEL)).toHaveValue(20);
    expect(screen.getByLabelText(MINUTE_LABEL)).toHaveValue(5);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the new limit', async () => {
    const user = userEvent.setup();
    renderSetting();
    const field = await screen.findByLabelText(LABEL);

    await user.clear(field);
    await user.type(field, '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ lessonsPerDay: 5, lessonsPerMinute: 5 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()); // saved: nothing to save any more
    expect(field).toHaveValue(5);
  });

  it('saves the new per-minute limit', async () => {
    const user = userEvent.setup();
    renderSetting();
    const field = await screen.findByLabelText(MINUTE_LABEL);

    await user.clear(field);
    await user.type(field, '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ lessonsPerDay: 20, lessonsPerMinute: 2 }));
  });

  it.each([
    ['0', 'At least 1'],
    ['61', 'At most 60'],
    ['1.5', 'Use a whole number'],
    ['', 'Enter a number'],
  ])('does not save a per-minute limit of %j and says why', async (value, message) => {
    const user = userEvent.setup();
    renderSetting();
    const field = await screen.findByLabelText(MINUTE_LABEL);

    await user.clear(field);
    if (value) await user.type(field, value);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('saves 0, which turns the AI off', async () => {
    const user = userEvent.setup();
    renderSetting();
    const field = await screen.findByLabelText(LABEL);

    await user.clear(field);
    await user.type(field, '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ lessonsPerDay: 0, lessonsPerMinute: 5 }));
  });

  it.each([
    ['-1', 'At least 0'],
    ['1001', 'At most 1000'],
    ['2.5', 'Use a whole number'],
    ['', 'Enter a number'],
  ])('does not save %j and says why', async (value, message) => {
    const user = userEvent.setup();
    renderSetting();
    const field = await screen.findByLabelText(LABEL);

    await user.clear(field);
    if (value) await user.type(field, value);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('says so, with a retry, when the setting cannot load', async () => {
    const user = userEvent.setup();
    getSettings.mockRejectedValueOnce(new Error('down'));
    renderSetting();

    await user.click(await screen.findByRole('button', { name: /try again|retry/i }));

    expect(await screen.findByLabelText(LABEL)).toBeInTheDocument();
  });
});
