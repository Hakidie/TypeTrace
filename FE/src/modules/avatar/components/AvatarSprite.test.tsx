import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { layerFiles } from '../lib/layers';
import { DEFAULT_AVATAR } from '../types/avatar.types';
import { AvatarSprite } from './AvatarSprite';

describe('AvatarSprite', () => {
  it('draws one image per layer in a fixed-size frame', () => {
    const { container } = render(<AvatarSprite look={DEFAULT_AVATAR} scale={2} />);

    const frame = screen.getByRole('img', { name: 'Avatar' });
    expect(frame).toHaveStyle({ width: '152px', height: '152px' });
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(layerFiles(DEFAULT_AVATAR, 'idle').length);
    expect(images[0].getAttribute('src')).toMatch(/\/avatar\/bottom\/navy\.png$/);
  });

  it('loads its layer images lazily, so a wardrobe tab of a hundred cards does not fetch them all at once', () => {
    const { container } = render(<AvatarSprite look={DEFAULT_AVATAR} />);

    container.querySelectorAll('img').forEach((image) => expect(image).toHaveAttribute('loading', 'lazy'));
  });

  it('does not load lazily when eager', () => {
    const { container } = render(<AvatarSprite look={DEFAULT_AVATAR} eager />);

    container.querySelectorAll('img').forEach((image) => expect(image).not.toHaveAttribute('loading'));
  });

  it('stacks the two frames of each moving item (the Pro dragon wings and baby dragon) so CSS can flap their wings', () => {
    const { container } = render(<AvatarSprite look={{ ...DEFAULT_AVATAR, back: 'dragon-wings', effect: 'baby-dragon' }} />);

    const sources = [...container.querySelectorAll('img')].map((image) => image.getAttribute('src'));
    expect(sources.slice(0, 2)).toEqual(['/avatar/back/dragon-wings.png', '/avatar/back/dragon-wings-flap.png']);
    expect(container.querySelectorAll('.avatar-flap-a')).toHaveLength(2);
    expect(container.querySelector('img[src="/avatar/effect/baby-dragon-flap.png"]')).toHaveClass('avatar-flap-b');
  });

  it('holds the raised frame of moving wings while the arms are up, and keeps the baby dragon beating', () => {
    const { container } = render(<AvatarSprite look={{ ...DEFAULT_AVATAR, back: 'dragon-wings', effect: 'baby-dragon' }} pose="win" />);

    expect(container.querySelectorAll('img[src*="/back/"]')).toHaveLength(1);
    expect(container.querySelector('img[src="/avatar/back/dragon-wings.png"]')).not.toHaveClass('avatar-flap-a');
    expect(container.querySelector('img[src="/avatar/effect/baby-dragon-flap.png"]')).toHaveClass('avatar-flap-b');
  });

  it('draws a still back item once, without flap classes', () => {
    const { container } = render(<AvatarSprite look={{ ...DEFAULT_AVATAR, back: 'bat-wings' }} />);

    expect(container.querySelectorAll('img[src*="/back/"]')).toHaveLength(1);
    expect(container.querySelector('.avatar-flap-a')).toBeNull();
  });

  it('shows only the head when cropped', () => {
    render(<AvatarSprite look={DEFAULT_AVATAR} scale={2} crop="head" label="Your avatar" />);

    expect(screen.getByRole('img', { name: 'Your avatar' })).toHaveStyle({ width: '80px', height: '80px' });
  });
});
