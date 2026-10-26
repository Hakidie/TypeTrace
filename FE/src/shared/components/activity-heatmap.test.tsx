import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityHeatmap, HEATMAP_DAYS } from './activity-heatmap';

const today = () => new Date().toISOString().slice(0, 10);
const cellsOf = () => Array.from(screen.getByRole('img', { name: 'Sessions' }).querySelectorAll('[title]'));

describe('ActivityHeatmap', () => {
  it('draws one cell per day, today last, with the sessions in the tooltip', () => {
    render(<ActivityHeatmap label="Sessions" days={[{ date: today(), sessions: 3 }]} />);

    const cells = cellsOf();
    expect(cells).toHaveLength(HEATMAP_DAYS);
    expect(screen.getByRole('img', { name: 'Sessions' }).children).toHaveLength(4);
    expect(cells[HEATMAP_DAYS - 1]).toHaveAttribute('title', `${today()}: 3 sessions`);
    expect(cells[HEATMAP_DAYS - 2]).toHaveAttribute('title', expect.stringContaining('no activity'));
  });

  it('says there is no data yet when no days are given', () => {
    render(<ActivityHeatmap label="Sessions" />);
    expect(cellsOf().at(-1)).toHaveAttribute('title', expect.stringContaining('no data yet'));
  });

  it('ignores sessions before the start date', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    render(<ActivityHeatmap label="Sessions" days={[{ date: yesterday, sessions: 2 }]} since={new Date().toISOString()} />);

    expect(cellsOf()[HEATMAP_DAYS - 2]).toHaveAttribute('title', expect.stringContaining('no activity'));
  });

  it('names the months of each block under it when asked', () => {
    render(<ActivityHeatmap label="Sessions" labels />);

    const blocks = Array.from(screen.getByRole('img', { name: 'Sessions' }).children);
    const names = blocks.map((block) => block.lastElementChild?.textContent);
    const thisMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][new Date().getUTCMonth()];
    expect(names).toHaveLength(4);
    names.forEach((name) => expect(name).toMatch(/^[A-Z][a-z]{2}( – [A-Z][a-z]{2})?$/));
    expect(names[3]).toMatch(new RegExp(`${thisMonth}$`));
  });

  it('has no labels by default', () => {
    render(<ActivityHeatmap label="Sessions" />);
    expect(screen.queryByText(/^[A-Z][a-z]{2}( – [A-Z][a-z]{2})?$/)).not.toBeInTheDocument();
  });
});
