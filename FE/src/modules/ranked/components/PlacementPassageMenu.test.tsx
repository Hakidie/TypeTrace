import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { PlacementPassageMenu } from './PlacementPassageMenu';

const passages = vi.fn();

vi.mock('@/modules/typing/api/typing.api', () => ({
  typingApi: { passages: (mode: string, language?: string, query?: unknown) => passages(mode, language, query) },
}));

const longTitle = 'Một đoạn văn có cái tên dài đến mức trước đây bị cắt ở giữa chừng không còn đọc được';
const options = [
  { _id: 'p1', title: 'Hà Nội vào thu', wordCount: 40, isSystem: true, isOwn: false, ownerName: 'TypeTrace' },
  { _id: 'p2', title: longTitle, wordCount: 35, isSystem: true, isOwn: false, ownerName: 'TypeTrace' },
];

beforeEach(() => {
  passages.mockReset().mockResolvedValue(options);
});

const renderMenu = (selectedId = 'p2') => {
  const onSelect = vi.fn();
  renderWithProviders(<PlacementPassageMenu passages={options} selectedId={selectedId} onSelect={onSelect} />);
  return { onSelect };
};

describe('PlacementPassageMenu', () => {
  it('shows the whole name of the selected passage, not cut', () => {
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Choose passage' });
    expect(trigger).toHaveTextContent(longTitle);
    expect(trigger.className).not.toMatch(/max-w-64/);
    expect(trigger.querySelector('span')?.className).not.toMatch(/truncate/);
  });

  it('opens with a search box and a sort, and no filter by origin: placement passages are all the system\'s', async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(passages).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Choose passage' }));

    expect(await screen.findByRole('textbox', { name: 'Search passages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sort:/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Filter:/ })).not.toBeInTheDocument();
    // Centered under the tabs of the page (it is placed against the row of the page, not against the button).
    const menu = screen.getByRole('menu', { name: 'Placement passages' });
    expect(menu).toHaveClass('left-1/2', '-translate-x-1/2');
    expect(menu).not.toHaveClass('sm:min-w-full');
    expect(menu.parentElement).toHaveClass('static');
    await waitFor(() => expect(passages).toHaveBeenCalledWith('placement', 'vi', { sort: '-createdAt' }));
  });

  it('searches the passages of the placement test', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Choose passage' }));

    await user.type(await screen.findByRole('textbox', { name: 'Search passages' }), 'thu{Enter}');

    await waitFor(() => expect(passages).toHaveBeenLastCalledWith('placement', 'vi', { sort: '-createdAt', q: 'thu' }));
  });

  it('picks a passage with a click and closes the menu', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMenu();
    await user.click(screen.getByRole('button', { name: 'Choose passage' }));

    await user.click(await screen.findByRole('menuitemradio', { name: /Hà Nội vào thu/ }));

    expect(onSelect).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Placement passages' })).not.toBeInTheDocument());
  });
});
