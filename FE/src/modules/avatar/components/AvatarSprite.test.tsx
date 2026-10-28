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

  it('shows only the head when cropped', () => {
    render(<AvatarSprite look={DEFAULT_AVATAR} scale={2} crop="head" label="Your avatar" />);

    expect(screen.getByRole('img', { name: 'Your avatar' })).toHaveStyle({ width: '80px', height: '80px' });
  });
});
