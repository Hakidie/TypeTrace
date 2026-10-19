import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from './search-input';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SearchInput', () => {
  it('reports the trimmed text once typing stops', () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: ' la' } });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: ' lan ' } });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('lan');
  });

  it('clears immediately with the clear button', () => {
    const onSearch = vi.fn();
    render(<SearchInput defaultValue="lan" onSearch={onSearch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearch).toHaveBeenCalledWith('');
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  it('with searchOn="enter" searches only when Enter is pressed', () => {
    const onSearch = vi.fn();
    render(<SearchInput searchOn="enter" onSearch={onSearch} />);

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: ' lan ' } });
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('lan');
  });
});
