import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { History } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { CompactToolbar } from './compact-toolbar';

const sortOptions = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'wpm', label: 'Slowest' },
];
const modeOptions = [{ value: 'practice', label: 'Practice' }];

describe('CompactToolbar', () => {
  it('shows Search, Sort, Filter and the total as icons whose word grows next to them while hovered', () => {
    render(
      <CompactToolbar
        search={{ label: 'Search sessions', onSearch: vi.fn() }}
        sort={{ value: '-createdAt', options: sortOptions, onChange: vi.fn() }}
        filters={[{ label: 'Mode', value: '', options: modeOptions, onChange: vi.fn() }]}
        count={{ icon: History, value: 8, label: 'Sessions' }}
      />,
    );

    for (const name of ['Sort', 'Filter']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('group');
      expect(within(button).getByText(name)).toHaveClass('max-w-0', 'opacity-0', 'group-hover:opacity-100');
    }
    expect(within(screen.getByRole('button', { name: 'Search sessions' })).getByText('Search')).toHaveClass('max-w-0', 'group-hover:opacity-100');
    expect(screen.getByText('Sessions')).toHaveClass('max-w-0', 'group-hover:opacity-100');
    expect(screen.getByText('Sessions').parentElement).toHaveTextContent('8Sessions');
  });

  it('has no background color, also when a filter is on, and the filter shows how many are on', () => {
    render(<CompactToolbar filters={[{ label: 'Mode', value: 'practice', options: modeOptions, onChange: vi.fn() }]} />);

    const filter = screen.getByRole('button', { name: 'Filter' });
    expect(filter).toHaveClass('bg-transparent');
    expect(filter.className).not.toMatch(/(^|\s)(hover:)?bg-(primary|muted)/);
    expect(screen.getByLabelText('1 active')).toBeInTheDocument();
  });

  it('opens the search box from its magnifier, and searches when Enter is pressed', async () => {
    const onSearch = vi.fn();
    render(<CompactToolbar search={{ label: 'Search sessions', onSearch }} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Search sessions' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Search sessions' }), ' thu {Enter}');

    expect(onSearch).toHaveBeenCalledWith('thu');
  });

  it('changes the sort and the filters from their menus', async () => {
    const onSort = vi.fn();
    const onMode = vi.fn();
    render(
      <CompactToolbar
        sort={{ value: '-createdAt', options: sortOptions, onChange: onSort }}
        filters={[{ label: 'Mode', value: '', options: modeOptions, onChange: onMode }]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sort' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Slowest' }));
    expect(onSort).toHaveBeenCalledWith('wpm');

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Practice' }));
    expect(onMode).toHaveBeenCalledWith('practice');
  });

  it('takes the padding on the right of its last part away', () => {
    render(<CompactToolbar count={{ icon: History, value: 3, label: 'Sessions' }} />);
    expect(screen.getByText('Sessions').parentElement?.parentElement).toHaveClass('[&>:last-child]:pr-0');
  });
});
