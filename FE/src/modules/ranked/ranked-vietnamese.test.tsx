import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { Countdown } from './components/Countdown';
import { LeaderboardLink } from './components/LeaderboardLink';
import { SeasonPanel } from './components/SeasonPanel';

describe('the Ranked module in Vietnamese (SCRUM-332)', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('vi'));
  });

  it('names the season, its days and the leaderboard link in Vietnamese', () => {
    render(
      <MemoryRouter>
        <SeasonPanel number={2} startsAt="2026-11-01T00:00:00Z" endsAt="2026-12-01T00:00:00Z" headline="Vàng" subline="1W" value={1200} lead={<LeaderboardLink />} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Season 2')).toBeInTheDocument();
    expect(screen.getByText('TỪ 1 Thg 11 2026')).toBeInTheDocument();
    expect(screen.getByText('ĐẾN 1 Thg 12 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bảng xếp hạng' })).toBeInTheDocument();
  });

  it('counts down in Vietnamese', () => {
    render(<Countdown endsAt={new Date(Date.now() - 1000).toISOString()} />);

    expect(screen.getByRole('status', { name: 'Đếm ngược' })).toHaveTextContent('Gõ!');
    expect(screen.getByText('Gõ đi!')).toBeInTheDocument();
  });
});
