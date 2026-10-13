import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InputLogEntry } from '../types/input-lab.types';
import { EventLogTable } from './EventLogTable';

const entriesOf = (count: number): InputLogEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    seq: index + 1,
    time: index * 10,
    type: 'input',
    inputType: 'insertText',
    data: 'a',
    isComposing: false,
    value: 'a'.repeat(index + 1),
    selectionStart: index + 1,
    selectionEnd: index + 1,
  }));

describe('EventLogTable', () => {
  it('shows every event of a short log without a notice', () => {
    render(<EventLogTable entries={entriesOf(10)} />);

    expect(screen.getAllByRole('row')).toHaveLength(11); // header + 10
    expect(screen.queryByText(/Showing the last/)).not.toBeInTheDocument();
  });

  it('draws only the newest 300 rows of a long log and says so', () => {
    render(<EventLogTable entries={entriesOf(1000)} />);

    expect(screen.getAllByRole('row')).toHaveLength(301);
    expect(screen.getByText('Showing the last 300 of 1000 events. Download has all of them.')).toBeInTheDocument();
    expect(screen.queryByText('700')).not.toBeInTheDocument();
    expect(screen.getByText('701')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });
});
