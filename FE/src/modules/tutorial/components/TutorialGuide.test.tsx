import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { createTestQueryClient, renderWithProviders } from '@/test/render-with-providers';
import type { TutorialState } from '../types/tutorial.types';
import { TutorialGuide } from './TutorialGuide';

const update = vi.fn();
vi.mock('../api/tutorial.api', () => ({
  tutorialApi: { start: vi.fn(), update: (body: unknown) => update(body), reset: vi.fn(), coach: vi.fn() },
}));

vi.mock('@/modules/rain/api/rain.api', () => ({ rainApi: { words: async () => ({ words: ['nhà', 'cửa'], focus: [] }) } }));

const user = (tutorial?: TutorialState): CurrentUser => ({
  _id: 'u1',
  email: 'a@example.com',
  isEmailVerified: true,
  role: 'user',
  loginOtpEnabled: false,
  createdAt: '',
  updatedAt: '',
  ...(tutorial && { tutorial }),
});

const renderGuide = (tutorial: TutorialState | undefined, route = '/typing') => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(currentUserKey, user(tutorial));
  return renderWithProviders(<TutorialGuide />, { route, path: '/typing', queryClient });
};

describe('TutorialGuide', () => {
  beforeEach(() => update.mockReset().mockImplementation(async () => user({ tour: 'skipped', modes: {} })));

  it('shows nothing to an account from before the tutorial', () => {
    renderGuide(undefined, '/typing?mode=rain');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Ping' })).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('welcomes a new account, then starts with Practice', () => {
    renderGuide({ tour: 'active', modes: {} });

    expect(screen.getByRole('dialog', { name: 'Chuyến hướng dẫn' })).toHaveTextContent('Mình là Ping');
    fireEvent.click(screen.getByRole('button', { name: 'Đi thôi' }));

    expect(screen.getByRole('dialog', { name: 'Chuyến hướng dẫn' })).toHaveTextContent('Đây là đoạn văn để luyện');
  });

  it('skips the whole tour from the welcome', async () => {
    renderGuide({ tour: 'active', modes: {} });

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ tour: 'skipped', mode: 'practice', status: 'skipped' }));
  });

  it('marks a mode done after its last step', async () => {
    renderGuide({ tour: 'skipped', modes: {} }, '/typing?mode=minigames&game=daily');

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ mode: 'daily', status: 'done' }));
  });

  it('guides a mode not learned yet after the tour was skipped', () => {
    renderGuide({ tour: 'skipped', modes: {} }, '/typing?mode=rain');

    expect(screen.getByRole('dialog', { name: 'Hướng dẫn Mưa chữ' })).toHaveTextContent('Mưa chữ: chữ rơi');
  });

  it('waits on the cards of the Minigames tab', () => {
    renderGuide({ tour: 'skipped', modes: {} }, '/typing?mode=minigames');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('skips only this mode in a per-mode guide', async () => {
    renderGuide({ tour: 'skipped', modes: {} }, '/typing?mode=rain');

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ mode: 'rain', status: 'skipped' }));
  });

  it('stays away from a mode already learned or skipped', () => {
    renderGuide({ tour: 'skipped', modes: { rain: 'skipped' } }, '/typing?mode=rain');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the practice duel at the end of Rank', async () => {
    renderGuide({ tour: 'skipped', modes: {} }, '/typing?mode=rank');

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đấu tập với Ping' }));

    const duel = await screen.findByRole('dialog', { name: 'Đấu tập với Ping' });
    expect(await within(duel).findByText('Đấu tập · không tính điểm')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('talks from the top when what it frames is at the bottom', () => {
    renderGuide({ tour: 'skipped', modes: {} }, '/typing');
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('số từ đã gõ và thời gian');
    expect(screen.getByRole('dialog').parentElement!.className).toContain('top-20');
  });

  it('moves to the top while the learner types a word, so the typing box stays visible', () => {
    renderGuide({ tour: 'skipped', modes: {} }, '/typing?mode=rain');
    const placeOf = () => screen.getByRole('dialog').parentElement!.className;
    expect(placeOf()).toContain('bottom-4');

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Gõ chữ đang khoanh đỏ');
    expect(placeOf()).toContain('top-20');
    expect(placeOf()).not.toContain('bottom-4');
  });
});
