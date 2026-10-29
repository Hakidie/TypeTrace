import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Ping } from './Ping';

describe('Ping', () => {
  it('plays the strip of the move', () => {
    render(<Ping move="point" />);

    const ping = screen.getByRole('img', { name: 'Ping' });
    expect(ping.style.backgroundImage).toContain('/mascot/ping-point.png');
    expect(ping.style.width).toBe('64px');
    expect(ping.style.height).toBe('88px');
  });

  it('draws twice as big', () => {
    render(<Ping move="happy" size={2} />);

    expect(screen.getByRole('img', { name: 'Ping' }).style.width).toBe('128px');
  });
});
