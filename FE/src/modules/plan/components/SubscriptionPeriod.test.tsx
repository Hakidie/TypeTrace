import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { termDaysText, termProgress } from '../lib/term-progress';
import { SubscriptionPeriod } from './SubscriptionPeriod';

describe('termProgress', () => {
  const start = '2026-01-01T00:00:00.000Z';
  const end = '2026-01-11T00:00:00.000Z';

  it('is how much of the term has passed, from 0 to 100', () => {
    expect(termProgress(start, end, new Date('2025-12-01T00:00:00Z').getTime())).toBe(0);
    expect(termProgress(start, end, new Date('2026-01-06T00:00:00Z').getTime())).toBe(50);
    expect(termProgress(start, end, new Date('2026-03-01T00:00:00Z').getTime())).toBe(100);
  });

  it('is full for a term without an end', () => {
    expect(termProgress(start, null)).toBe(100);
  });
});

describe('termDaysText', () => {
  const start = '2026-01-01T00:00:00.000Z';
  const end = '2026-01-11T00:00:00.000Z';
  const at = (iso: string) => new Date(iso).getTime();

  it('counts the days left, the days before the start, and says when the term is over or open', () => {
    expect(termDaysText(start, end, at('2026-01-06T00:00:00Z'))).toBe('5 days left');
    expect(termDaysText(start, end, at('2026-01-10T12:00:00Z'))).toBe('1 day left');
    expect(termDaysText(start, end, at('2025-12-30T00:00:00Z'))).toBe('Starts in 2 days');
    expect(termDaysText(start, end, at('2026-02-01T00:00:00Z'))).toBe('Ended');
    expect(termDaysText(start, null)).toBe('No end date');
  });
});

describe('SubscriptionPeriod', () => {
  it('shows the start on the left and the end on the right under a progress bar', () => {
    render(<SubscriptionPeriod row={{ startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-02-01T00:00:00.000Z', changedByName: null }} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('01/01/26')).toBeInTheDocument();
    expect(screen.getByText('01/02/26')).toBeInTheDocument();
  });

  it('names the admin who made the change between the two days', () => {
    render(<SubscriptionPeriod row={{ startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-02-01T00:00:00.000Z', changedByName: 'Boss' }} />);

    expect(screen.getByText('by Boss')).toBeInTheDocument();
  });

  it('says Now while the term has no end', () => {
    render(<SubscriptionPeriod row={{ startsAt: '2026-01-01T00:00:00.000Z', endsAt: null, changedByName: null }} />);

    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});
