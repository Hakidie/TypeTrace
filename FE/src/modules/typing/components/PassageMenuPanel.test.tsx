import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { PassageMenuPanel } from './PassageMenuPanel';

const passages = vi.fn();

vi.mock('../api/typing.api', () => ({
  typingApi: {
    passages: (mode: string, language?: string, query?: unknown) => passages(mode, language, query),
  },
}));

const fixtures = [
  { _id: 'p1', title: 'Hà Nội vào thu', wordCount: 40, isSystem: true, isOwn: false, ownerName: 'TypeTrace' },
  { _id: 'p2', title: 'Bữa cơm gia đình', wordCount: 35, isSystem: false, isOwn: false, ownerName: 'Lan' },
  { _id: 'p3', title: 'Bài của tôi', wordCount: 30, isSystem: false, isOwn: true, ownerName: 'Mình' },
];

beforeEach(() => {
  passages.mockReset().mockResolvedValue(fixtures);
});

const renderPanel = (props: Partial<Parameters<typeof PassageMenuPanel>[0]> = {}) => {
  const onSelect = vi.fn();
  const onNeedPremium = vi.fn();
  renderWithProviders(<PassageMenuPanel mode="practice" language="vi" showOriginFilter onSelect={onSelect} onNeedPremium={onNeedPremium} {...props} />);
  return { onSelect, onNeedPremium };
};

const box = () => screen.getByRole('textbox', { name: 'Search passages' });
const filterButton = () => screen.getByRole('button', { name: /^Filter:/ });
const sortButton = () => screen.getByRole('button', { name: /^Sort:/ });

describe('PassageMenuPanel', () => {
  it('asks for the newest system passages first', async () => {
    renderPanel();
    await screen.findByText('Hà Nội vào thu');
    expect(passages).toHaveBeenCalledTimes(1);
    expect(passages).toHaveBeenCalledWith('practice', 'vi', { sort: '-createdAt', origin: 'system' });
  });

  it('puts the Sort before the Filter, and draws no border and no focus ring around the box and the buttons', async () => {
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    expect(sortButton().compareDocumentPosition(filterButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const control of [box(), sortButton(), filterButton()]) {
      expect(control.className).not.toMatch(/(^|\s)border(\s|$)/);
      expect(control.className).not.toMatch(/focus-visible:ring-2/);
    }
  });

  it('puts the search box, the Sort and the Filter in one row: no Search button, the word Search and a magnifier in the box', async () => {
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    const row = screen.getByRole('search');
    expect(within(row).getByRole('textbox', { name: 'Search passages' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /^Sort:/ })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /^Filter:/ })).toBeInTheDocument();
    expect(within(row).getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
    // The placeholder is the word Search, after the magnifier.
    expect(box()).toHaveAttribute('placeholder', 'Search');
    expect(row.querySelector('.lucide-search')).not.toBeNull();
  });

  it('shows the icon of Sort and Filter, and their word only while hovered, with the box taking the room so the menu keeps its width', async () => {
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    for (const button of [sortButton(), filterButton()]) {
      expect(button.querySelector('svg')).not.toBeNull();
      // The word is in the button and shown by hover or focus only (CSS), the button has no fixed-size square.
      expect(button.querySelector('span')).toHaveClass('hidden', 'group-hover:inline', 'group-focus-visible:inline');
    }
    expect(sortButton().querySelector('span')).toHaveTextContent('Sort: Newest');
    expect(filterButton().querySelector('span')).toHaveTextContent('Filter: System');
    // The box adds nothing to the width of the row (`w-0 flex-1`), so a word that shows only shortens it.
    expect(box().parentElement).toHaveClass('w-0', 'flex-1', 'min-w-0');
  });

  it('has no Filter in the placement menu: its passages are all the system\'s, and sends no origin', async () => {
    renderPanel({ mode: 'placement', showOriginFilter: false });
    await screen.findByText('Hà Nội vào thu');

    expect(passages).toHaveBeenCalledWith('placement', 'vi', { sort: '-createdAt' });
    expect(screen.queryByRole('button', { name: /^Filter:/ })).not.toBeInTheDocument();
    expect(sortButton()).toBeInTheDocument();
  });

  it('goes round System, Mine, Others and back with the Filter button, and has no "All"', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    expect(filterButton()).toHaveAccessibleName('Filter: System');
    await user.click(filterButton());
    expect(filterButton()).toHaveAccessibleName('Filter: Mine');
    await user.click(filterButton());
    expect(filterButton()).toHaveAccessibleName('Filter: Others');
    await user.click(filterButton());
    expect(filterButton()).toHaveAccessibleName('Filter: System');
    expect(screen.queryByText('All')).not.toBeInTheDocument();
  });

  it('goes round Newest, Name A–Z, Words and back with the Sort button', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    expect(sortButton()).toHaveAccessibleName('Sort: Newest');
    await user.click(sortButton());
    expect(sortButton()).toHaveAccessibleName('Sort: Name A–Z');
    await user.click(sortButton());
    expect(sortButton()).toHaveAccessibleName('Sort: Words');
    await user.click(sortButton());
    expect(sortButton()).toHaveAccessibleName('Sort: Newest');
  });

  it('asks again at once when the Sort or the Filter changes, with the search that was made', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    await user.click(sortButton());
    await waitFor(() => expect(passages).toHaveBeenLastCalledWith('practice', 'vi', { sort: 'title', origin: 'system' }));
    await user.click(filterButton());
    await waitFor(() => expect(passages).toHaveBeenLastCalledWith('practice', 'vi', { sort: 'title', origin: 'mine' }));
    expect(passages).toHaveBeenCalledTimes(3);
  });

  it('searches only when the learner presses Enter in the box, and keeps the search when the Sort or the Filter changes', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    await user.type(box(), 'tình');
    // Typing asks for nothing.
    expect(passages).toHaveBeenCalledTimes(1);

    await user.type(box(), '{Enter}');
    await waitFor(() => expect(passages).toHaveBeenLastCalledWith('practice', 'vi', { sort: '-createdAt', origin: 'system', q: 'tình' }));
    expect(passages).toHaveBeenCalledTimes(2);

    await user.click(filterButton());
    await waitFor(() => expect(passages).toHaveBeenLastCalledWith('practice', 'vi', { sort: '-createdAt', origin: 'mine', q: 'tình' }));

    // Words typed after the search, not yet sent with Enter, are not part of the next ask.
    await user.type(box(), ' phố');
    await user.click(sortButton());
    await waitFor(() => expect(passages).toHaveBeenLastCalledWith('practice', 'vi', { sort: 'title', origin: 'mine', q: 'tình' }));
  });

  it('clears the search when the box is emptied and Enter is pressed', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Hà Nội vào thu');
    await user.type(box(), 'tình{Enter}');
    await waitFor(() => expect(passages).toHaveBeenLastCalledWith('practice', 'vi', expect.objectContaining({ q: 'tình' })));

    await user.clear(box());
    await user.type(box(), '{Enter}');

    await waitFor(() => expect(passages).toHaveBeenLastCalledWith('practice', 'vi', { sort: '-createdAt', origin: 'system' }));
  });

  it('tags the system passages and the passages of other learners with their public name, and shows no email', async () => {
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    // "System" is also the word of the Filter button: the tag is the one inside the row.
    expect(within(screen.getByRole('menuitemradio', { name: /Hà Nội vào thu/ })).getByText('System')).toBeInTheDocument();
    expect(within(screen.getByRole('menuitemradio', { name: /Bữa cơm gia đình/ })).getByText('Lan')).toBeInTheDocument();
    // The learner's own passage has no tag.
    expect(screen.queryByText('Mình')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('@');
  });

  it('picks a passage with a click', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPanel();

    await user.click(await screen.findByRole('menuitemradio', { name: /Bữa cơm gia đình/ }));

    expect(onSelect).toHaveBeenCalledWith('p2');
  });

  it('marks the selected passage', async () => {
    renderPanel({ selectedId: 'p3' });
    expect(await screen.findByRole('menuitemradio', { name: /Bài của tôi/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('opens the plan for a passage the plan locks, and does nothing for one past the limit', async () => {
    const user = userEvent.setup();
    passages.mockResolvedValue([
      { ...fixtures[1], lockedByPlan: true },
      { ...fixtures[2], locked: true },
    ]);
    const { onSelect, onNeedPremium } = renderPanel();

    await user.click(await screen.findByRole('menuitemradio', { name: /Bữa cơm gia đình/ }));
    expect(onNeedPremium).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('menuitemradio', { name: /Bài của tôi/ }));

    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onNeedPremium).toHaveBeenCalledTimes(1);
  });

  it('says "No passages" for an empty bank and "No passages match" after a search', async () => {
    const user = userEvent.setup();
    passages.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText('No passages')).toBeInTheDocument();

    await user.type(box(), 'zzz{Enter}');

    expect(await screen.findByText('No passages match')).toBeInTheDocument();
  });

  it('says "No passages match" for a filter other than the default too', async () => {
    const user = userEvent.setup();
    passages.mockResolvedValue([]);
    renderPanel();
    await screen.findByText('No passages');

    await user.click(filterButton());

    expect(await screen.findByText('No passages match')).toBeInTheDocument();
  });

  it('shows an error when the passages cannot be loaded', async () => {
    passages.mockRejectedValue(new Error('boom'));
    renderPanel();
    expect(await screen.findByText('Could not load passages')).toBeInTheDocument();
  });

  it('puts the cursor in the search box when the menu opens, so the learner can type at once', async () => {
    renderPanel();
    await screen.findByText('Hà Nội vào thu');

    expect(box()).toHaveFocus();
  });

  it('keeps the list and picks nothing while the learner types in the search box', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPanel();
    await screen.findByText('Hà Nội vào thu');

    await user.type(box(), 'bữa');

    expect(onSelect).not.toHaveBeenCalled();
    expect(box()).toHaveValue('bữa');
    expect(screen.getByText('Hà Nội vào thu')).toBeInTheDocument();
  });
});
