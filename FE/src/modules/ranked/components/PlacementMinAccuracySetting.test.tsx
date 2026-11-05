import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { PlacementMinAccuracySetting } from './PlacementMinAccuracySetting';

const placementSettings = vi.fn();
const updatePlacementSettings = vi.fn();

vi.mock('../api/ranked.api', () => ({
  rankedApi: {
    placementSettings: () => placementSettings(),
    updatePlacementSettings: (settings: unknown) => updatePlacementSettings(settings),
  },
}));

beforeEach(() => {
  tokenStore.set('test-token');
  placementSettings.mockReset().mockResolvedValue({ minAccuracy: 90 });
  updatePlacementSettings.mockReset().mockImplementation(async (settings: { minAccuracy: number }) => settings);
});

const renderPage = () => renderWithProviders(<PlacementMinAccuracySetting />);

describe('PlacementMinAccuracySetting', () => {
  it('shows the minimum accuracy in use, with Save off until it changes', async () => {
    renderPage();

    expect(await screen.findByLabelText('Minimum accuracy (%)')).toHaveValue(90);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the new minimum accuracy', async () => {
    const user = userEvent.setup();
    renderPage();
    const field = await screen.findByLabelText('Minimum accuracy (%)');

    await user.clear(field);
    await user.type(field, '80');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updatePlacementSettings).toHaveBeenCalledWith({ minAccuracy: 80 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()); // saved: nothing to save any more
    expect(field).toHaveValue(80);
  });

  it.each([
    ['49', 'At least 50'],
    ['101', 'At most 100'],
    ['90.5', 'Use a whole number'],
    ['', 'Enter a number'],
  ])('does not save %j and says why', async (value, message) => {
    const user = userEvent.setup();
    renderPage();
    const field = await screen.findByLabelText('Minimum accuracy (%)');

    await user.clear(field);
    if (value) await user.type(field, value);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(updatePlacementSettings).not.toHaveBeenCalled();
  });

  it('says so, with a retry, when the setting cannot load', async () => {
    const user = userEvent.setup();
    placementSettings.mockRejectedValueOnce(new Error('down'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: /try again|retry/i }));

    expect(await screen.findByLabelText('Minimum accuracy (%)')).toBeInTheDocument();
  });
});
