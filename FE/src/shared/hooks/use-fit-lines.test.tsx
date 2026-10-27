import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFitLines } from './use-fit-lines';

const Box = ({ min, lineHeight = '20px' }: { min?: number; lineHeight?: string }) => {
  const { ref, lines } = useFitLines<HTMLDivElement>(min);
  return (
    <div ref={ref} style={{ lineHeight }}>
      lines: {lines ?? 'unknown'}
    </div>
  );
};

let height = 0;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFitLines', () => {
  it('counts the whole lines that fit in the box', () => {
    height = 95;
    render(<Box />);
    expect(screen.getByText('lines: 4')).toBeInTheDocument();
  });

  it('never goes below the minimum', () => {
    height = 10;
    render(<Box min={2} />);
    expect(screen.getByText('lines: 2')).toBeInTheDocument();
  });

  it('stays unknown while the line height cannot be measured', () => {
    height = 95;
    render(<Box lineHeight="normal" />);
    expect(screen.getByText('lines: unknown')).toBeInTheDocument();
  });
});
