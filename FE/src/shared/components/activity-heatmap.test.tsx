import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityHeatmap, HEATMAP_DAYS } from './activity-heatmap';

const today = () => new Date().toISOString().slice(0, 10);

describe('ActivityHeatmap', () => {
  it('draws one cell per day, today last, with the sessions in the tooltip', () => {
    render(<ActivityHeatmap label="Sessions" days={[{ date: today(), sessions: 3 }]} />);

    const cells = screen.getByRole('img', { name: 'Sessions' }).children;
    expect(cells).toHaveLength(HEATMAP_DAYS);
    expect(cells[HEATMAP_DAYS - 1]).toHaveAttribute('title', `${today()}: 3 sessions`);
    expect(cells[HEATMAP_DAYS - 2]).toHaveAttribute('title', expect.stringContaining('no activity'));
  });

  it('says there is no data yet when no days are given', () => {
    render(<ActivityHeatmap label="Sessions" />);
    expect(screen.getByRole('img', { name: 'Sessions' }).lastElementChild).toHaveAttribute('title', expect.stringContaining('no data yet'));
  });

  it('ignores sessions before the start date', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    render(<ActivityHeatmap label="Sessions" days={[{ date: yesterday, sessions: 2 }]} since={new Date().toISOString()} />);

    expect(screen.getByRole('img', { name: 'Sessions' }).children[HEATMAP_DAYS - 2]).toHaveAttribute('title', expect.stringContaining('no activity'));
  });
});
