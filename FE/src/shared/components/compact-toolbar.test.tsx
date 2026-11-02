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

  it('shows the choice of a menu of its own next to its icon and reports a pick', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CompactToolbar
        menus={[{ label: 'Chart range', icon: History, valueLabel: 'Year', value: 'year', onChange, options: [{ value: 'year', label: 'Year' }, { value: 'week', label: 'Week' }] }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Chart range' })).toHaveTextContent('Year');
    await user.click(screen.getByRole('button', { name: 'Chart range' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Year' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: 'Week' }));

    expect(onChange).toHaveBeenCalledWith('week');
  });

  it('has a + that opens a menu of groups, each with a second menu of options beside it, and tags of what was added with an x to take each away', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onRemove = vi.fn();
    render(
      <CompactToolbar
        adder={{ label: 'Add comparison', groups: [{ label: 'Year', options: [{ value: '2025', label: '2025' }, { value: '2024', label: '2024' }], selected: ['2025'], onPick }] }}
        tags={[{ id: 'year:2025', label: 'Year 2025', onRemove }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add comparison' }));
    // The groups first; a second menu with the options of one opens beside them.
    expect(screen.queryByRole('menu', { name: 'Year periods' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'Year' }));
    const group = await screen.findByRole('menu', { name: 'Year periods' });
    expect(within(group).getByRole('menuitemradio', { name: '2025' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(group).getByRole('menuitemradio', { name: '2024' }));
    expect(onPick).toHaveBeenCalledWith('2024');

    expect(screen.getByText('Year 2025')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Year 2025' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('puts the tags on the left of the +, the + before the menus, and shows the x of a tag only while it is hovered', () => {
    render(
      <CompactToolbar
        menus={[{ label: 'Chart range', icon: History, valueLabel: 'Month', value: 'month', onChange: vi.fn(), options: [{ value: 'month', label: 'Month' }] }]}
        adder={{ label: 'Add comparison', groups: [] }}
        tags={[{ id: 'year:2025', label: 'Year 2025', onRemove: vi.fn() }]}
      />,
    );

    const tag = screen.getByText('Year 2025');
    const add = screen.getByRole('button', { name: 'Add comparison' });
    const range = screen.getByRole('button', { name: 'Chart range' });
    expect(tag.compareDocumentPosition(add)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(add.compareDocumentPosition(range)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(tag).toHaveClass('group');
    expect(screen.getByRole('button', { name: 'Remove Year 2025' })).toHaveClass('opacity-0', 'group-hover:opacity-100', 'focus-visible:opacity-100');
  });

  it('takes extra classes for its row, to sit at the left edge', () => {
    const { container } = render(<CompactToolbar className="sm:justify-start" count={{ icon: History, value: 3, label: 'Sessions' }} />);

    expect(container.firstChild).toHaveClass('sm:justify-start');
    expect(container.firstChild).not.toHaveClass('sm:justify-end');
  });

  it('turns the + off when no more can be added', () => {
    render(<CompactToolbar adder={{ label: 'Add comparison', disabled: true, groups: [] }} />);

    expect(screen.getByRole('button', { name: 'Add comparison' })).toBeDisabled();
  });
});
