import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BotSprite } from './BotSprite';

describe('BotSprite', () => {
  it('plays the strip of the level bot and move', () => {
    render(<BotSprite level="hard" move="win" size={2} />);

    const sprite = screen.getByRole('img', { name: 'Dạ' });
    expect(sprite.style.backgroundImage).toContain('/bots/da-win.png');
    expect(sprite.style.width).toBe('128px');
  });
});
