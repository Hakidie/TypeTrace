import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';

const rect = (left: number, right: number) => ({ left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

const openMenu = async () => {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Sort</DropdownMenuTrigger>
      <DropdownMenuContent align="end" role="menu">
        <DropdownMenuItem>Newest</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Sort' }));
  return screen.getByRole('menu');
};

afterEach(() => vi.restoreAllMocks());

describe('DropdownMenu', () => {
  it('moves a menu that runs off the left edge of the screen back onto it', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(-60, 116));
    expect(await openMenu()).toHaveStyle({ translate: '68px' });
  });

  it('moves a menu that runs off the right edge back onto the screen', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(300, 450));
    expect(await openMenu()).toHaveStyle({ translate: '-58px' });
  });

  it('leaves a menu that fits where it is', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100, 250));
    expect((await openMenu()).style.translate).toBe('');
  });
});
