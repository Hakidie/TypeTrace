import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dayInWords } from '@/shared/lib/local-date';
import { ActivityHeatmap, HEATMAP_DAYS } from './activity-heatmap';

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const cellsOf = () => Array.from(screen.getByRole('img', { name: 'Sessions' }).querySelectorAll('[data-date]'));
const cell = (date: string) => screen.getByRole('img', { name: 'Sessions' }).querySelector(`[data-date="${date}"]`) as HTMLElement;
/** The tooltip shown once the pointer is over `element`. */
const tooltipOver = (element: Element) => {
  fireEvent.mouseOver(element);
  return screen.getByRole('tooltip');
};

/** Evening in UTC, already the next morning in Ho Chi Minh City (UTC+7). Only `Date` is faked, so the other timers still run. */
const atEveningOf10March = () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T18:00:00Z'));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('ActivityHeatmap', () => {
  it('draws one cell per day, today last, with the sessions in the tooltip', () => {
    render(<ActivityHeatmap label="Sessions" days={[{ date: today(), sessions: 3 }]} />);

    const cells = cellsOf();
    expect(cells).toHaveLength(HEATMAP_DAYS);
    expect(screen.getByRole('img', { name: 'Sessions' }).children).toHaveLength(4);
    expect(cells[HEATMAP_DAYS - 1]).toHaveAttribute('data-date', today());
    expect(tooltipOver(cells[HEATMAP_DAYS - 1])).toHaveTextContent(`Today · ${dayInWords(today())}3 sessions`);
    expect(tooltipOver(cells[HEATMAP_DAYS - 2])).toHaveTextContent(`${dayInWords(yesterday())}No sessions`);
  });

  it('shows the day and its sessions in a tooltip over the cell the pointer is on, and hides it when the pointer leaves', () => {
    render(<ActivityHeatmap label="Sessions" days={[{ date: today(), sessions: 1 }]} />);
    const grid = screen.getByRole('img', { name: 'Sessions' });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(tooltipOver(cellsOf()[HEATMAP_DAYS - 1])).toHaveTextContent('1 session');
    expect(tooltipOver(cellsOf()[HEATMAP_DAYS - 2])).toHaveTextContent('No sessions');
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    fireEvent.mouseLeave(grid);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('has no browser titles on the cells: the one tooltip replaces them', () => {
    render(<ActivityHeatmap label="Sessions" days={[{ date: today(), sessions: 2 }]} />);

    expect(screen.getByRole('img', { name: 'Sessions' }).querySelectorAll('[title]')).toHaveLength(0);
  });

  it('says there is no data yet when no days are given', () => {
    render(<ActivityHeatmap label="Sessions" />);
    expect(tooltipOver(cellsOf().at(-1)!)).toHaveTextContent('No data yet');
  });

  it('ignores sessions before the start date', () => {
    render(<ActivityHeatmap label="Sessions" days={[{ date: yesterday(), sessions: 2 }]} since={new Date().toISOString()} />);

    expect(tooltipOver(cellsOf()[HEATMAP_DAYS - 2])).toHaveTextContent('No sessions');
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

  describe('time zone (SCRUM-31)', () => {
    it("takes today in the learner's zone: the 11th is already today in Ho Chi Minh City, and the 12th is to come", () => {
      atEveningOf10March();
      render(<ActivityHeatmap label="Sessions" days={[]} timeZone="Asia/Ho_Chi_Minh" calendarYear />);

      expect(tooltipOver(cell('2026-03-11'))).toHaveTextContent('Today · Wed, 11 Mar 2026No sessions');
      expect(tooltipOver(cell('2026-03-12'))).toHaveTextContent('Thu, 12 Mar 2026Upcoming');
    });

    it('keeps UTC days without a zone, as the admin list does: the 11th is still to come', () => {
      atEveningOf10March();
      render(<ActivityHeatmap label="Sessions" days={[]} calendarYear />);

      expect(tooltipOver(cell('2026-03-10'))).toHaveTextContent('Today · Tue, 10 Mar 2026No sessions');
      expect(tooltipOver(cell('2026-03-11'))).toHaveTextContent('Upcoming');
    });

    it('ends the last days at today in the zone, and takes the start day in it too', () => {
      atEveningOf10March();
      // The account was made on the evening of the 10th in UTC: the 11th in Ho Chi Minh City, so the 10th there is before it.
      render(
        <ActivityHeatmap
          label="Sessions"
          days={[{ date: '2026-03-10', sessions: 2 }, { date: '2026-03-11', sessions: 1 }]}
          since="2026-03-10T17:30:00Z"
          timeZone="Asia/Ho_Chi_Minh"
        />,
      );

      const cells = cellsOf();
      expect(cells[HEATMAP_DAYS - 1]).toHaveAttribute('data-date', '2026-03-11');
      expect(tooltipOver(cells[HEATMAP_DAYS - 1])).toHaveTextContent('1 session');
      expect(tooltipOver(cells[HEATMAP_DAYS - 2])).toHaveTextContent('Tue, 10 Mar 2026No sessions');
      expect(cells[0]).toHaveAttribute('data-date', '2025-03-06');
    });
  });

  describe('daily mission mark (SCRUM-31)', () => {
    it('marks the days whose mission was done, and no other day', () => {
      atEveningOf10March();
      render(
        <ActivityHeatmap
          label="Sessions"
          days={[
            { date: '2026-03-02', sessions: 1, missionCompleted: true },
            { date: '2026-03-03', sessions: 3 },
            { date: '2026-03-04', sessions: 2, missionCompleted: false },
            { date: '2026-03-09', sessions: 7, missionCompleted: true },
          ]}
          calendarYear
        />,
      );

      const marked = Array.from(screen.getByRole('img', { name: 'Sessions' }).querySelectorAll('[data-mission]'));
      expect(marked.map((mark) => mark.parentElement?.getAttribute('data-date'))).toEqual(['2026-03-02', '2026-03-09']);
    });

    it('draws the mark in the text color, and in the page color on the darkest step, where the text color would fade', () => {
      atEveningOf10March();
      render(
        <ActivityHeatmap
          label="Sessions"
          days={[
            { date: '2026-03-02', sessions: 1, missionCompleted: true },
            { date: '2026-03-03', sessions: 6, missionCompleted: true },
            { date: '2026-03-09', sessions: 7, missionCompleted: true },
          ]}
          calendarYear
        />,
      );

      expect(cell('2026-03-02').querySelector('[data-mission]')).toHaveClass('bg-foreground');
      expect(cell('2026-03-03').querySelector('[data-mission]')).toHaveClass('bg-foreground');
      expect(cell('2026-03-09')).toHaveClass('bg-primary');
      expect(cell('2026-03-09').querySelector('[data-mission]')).toHaveClass('bg-background');
      expect(cell('2026-03-09').querySelector('[data-mission]')).not.toHaveClass('bg-foreground');
    });

    it('does not mark a day before the start date', () => {
      atEveningOf10March();
      render(<ActivityHeatmap label="Sessions" days={[{ date: '2026-03-02', sessions: 1, missionCompleted: true }]} since="2026-03-05T00:00:00Z" calendarYear />);

      expect(cell('2026-03-02').querySelector('[data-mission]')).not.toBeInTheDocument();
      const tooltip = tooltipOver(cell('2026-03-02'));
      expect(tooltip).toHaveTextContent('No sessions');
      expect(tooltip).not.toHaveTextContent('Mission done');
    });
  });

  describe('tooltip of a learner day (SCRUM-31)', () => {
    const days = [
      { date: '2026-03-11', sessions: 3, missionCompleted: true },
      { date: '2026-03-09', sessions: 1 },
    ];
    const renderLearnerDays = () =>
      render(<ActivityHeatmap label="Sessions" days={days} timeZone="Asia/Ho_Chi_Minh" unit="counted session" calendarYear />);

    it('is one tooltip over the hovered cell: the day in words, the sessions and the mission', () => {
      atEveningOf10March();
      renderLearnerDays();

      const tooltip = tooltipOver(cell('2026-03-11'));
      expect(tooltip).toHaveTextContent('Today · Wed, 11 Mar 2026');
      expect(tooltip).toHaveTextContent('3 counted sessions');
      expect(tooltip).toHaveTextContent('Mission done');
      expect(tooltip).toHaveClass('pointer-events-none');
      expect(tooltip.parentElement).toBe(document.body);

      fireEvent.mouseOver(cell('2026-03-09'));
      expect(screen.getAllByRole('tooltip')).toHaveLength(1);
      expect(screen.getByRole('tooltip')).toHaveTextContent('Mon, 9 Mar 2026');
      expect(screen.getByRole('tooltip')).toHaveTextContent('1 counted session');
      expect(screen.getByRole('tooltip')).not.toHaveTextContent('Mission done');
      expect(screen.getByRole('tooltip')).not.toHaveTextContent('Today');
    });

    it('says when a day had no session or is still to come', () => {
      atEveningOf10March();
      renderLearnerDays();

      expect(tooltipOver(cell('2026-03-10'))).toHaveTextContent('Tue, 10 Mar 2026No counted sessions');
      expect(tooltipOver(cell('2026-03-12'))).toHaveTextContent('Thu, 12 Mar 2026Upcoming');
    });

    it('goes away when the mouse leaves the heatmap or the page scrolls', () => {
      atEveningOf10March();
      renderLearnerDays();

      fireEvent.mouseOver(cell('2026-03-09'));
      fireEvent.mouseLeave(screen.getByRole('img', { name: 'Sessions' }));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      fireEvent.mouseOver(cell('2026-03-09'));
      fireEvent.scroll(window);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('draws the legend when asked: the five steps with the colors of the cells, and the mission mark', () => {
    atEveningOf10March();
    const steps = [0, 1, 2, 4, 7];
    const days = steps.map((sessions, index) => ({ date: `2026-03-0${index + 1}`, sessions }));
    render(<ActivityHeatmap label="Sessions" days={days} calendarYear legend />);

    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
    expect(screen.getByText('Mission done').querySelector('[class*="bg-foreground"]')).toBeInTheDocument();
    const swatches = Array.from(document.querySelectorAll('[data-swatch]'));
    expect(swatches).toHaveLength(5);
    swatches.forEach((swatch, level) => {
      const color = Array.from(swatch.classList).find((name) => name.startsWith('bg-'));
      expect(cell(`2026-03-0${level + 1}`)).toHaveClass(color as string);
    });
  });

  it('without the learner options, as in the admin user list: sessions in the tooltip, no legend, no mark', () => {
    render(<ActivityHeatmap label="Sessions" days={[{ date: today(), sessions: 2 }]} since="2020-01-01T00:00:00.000Z" />);

    expect(cellsOf()).toHaveLength(HEATMAP_DAYS);
    expect(tooltipOver(cellsOf()[HEATMAP_DAYS - 1])).toHaveTextContent('2 sessions');
    expect(screen.queryByText('Less')).not.toBeInTheDocument();
    expect(document.querySelector('[data-mission]')).not.toBeInTheDocument();
  });
});
