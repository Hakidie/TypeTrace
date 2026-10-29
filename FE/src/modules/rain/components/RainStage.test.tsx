import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import type { RainDrop } from '../types/rain.types';
import { RainStage } from './RainStage';

const drop = (overrides: Partial<RainDrop> & { id: string }): RainDrop => ({ text: 'cat', x: 50, fallMs: 4000, typed: 0, state: 'falling', ...overrides });

/** jsdom has no AnimationEvent (the event carries the animation name by hand) and React listens there to the prefixed name. */
const endAnimation = (element: Element, animationName: string) =>
  fireEvent(element, Object.assign(new Event('webkitAnimationEnd', { bubbles: true }), { animationName }));

const bodyImage = (container: HTMLElement) => [...container.querySelectorAll('img')].find((image) => image.getAttribute('src')?.startsWith('/avatar/body/'));

const renderStage = (props: Partial<React.ComponentProps<typeof RainStage>> = {}) =>
  render(<RainStage drops={[]} avatar={DEFAULT_AVATAR} phase="playing" onLand={vi.fn()} {...props} />);

describe('RainStage', () => {
  it('renders each drop with its text and fall duration', () => {
    renderStage({ drops: [drop({ id: 'a', text: 'cat', fallMs: 4000 }), drop({ id: 'b', text: 'dog', fallMs: 6000 })] });

    expect(screen.getByTestId('fall-a')).toHaveStyle({ animationDuration: '4000ms' });
    expect(screen.getByTestId('fall-b')).toHaveStyle({ animationDuration: '6000ms' });
    expect(screen.getByTestId('fall-a')).toHaveTextContent('cat');
    expect(screen.getByTestId('fall-b')).toHaveTextContent('dog');
  });

  it('reports a landing once, and ignores animations of other elements', () => {
    const onLand = vi.fn();
    renderStage({ drops: [drop({ id: 'a' })], onLand });

    endAnimation(screen.getByTestId('fall-a'), 'rain-gone');
    expect(onLand).not.toHaveBeenCalled();
    endAnimation(screen.getByTestId('fall-a'), 'rain-fall');

    expect(onLand).toHaveBeenCalledTimes(1);
    expect(onLand).toHaveBeenCalledWith('a');
  });

  it('does not report a landing for a word that was already typed', () => {
    const onLand = vi.fn();
    renderStage({ drops: [drop({ id: 'a', state: 'popped' })], onLand });

    endAnimation(screen.getByTestId('fall-a'), 'rain-fall');

    expect(onLand).not.toHaveBeenCalled();
  });

  it('keeps a drop at the edge inside the stage', () => {
    renderStage({ drops: [drop({ id: 'r', x: 100 }), drop({ id: 'far', x: 150 }), drop({ id: 'l', x: -20 })] });

    expect(screen.getByTestId('slot-r')).toHaveStyle({ left: '100%', transform: 'translateX(-100%)' });
    expect(screen.getByTestId('slot-far')).toHaveStyle({ left: '100%', transform: 'translateX(-100%)' });
    expect(screen.getByTestId('slot-l')).toHaveStyle({ left: '0%' });
  });

  it('marks the typed letters', () => {
    renderStage({ drops: [drop({ id: 'a', text: 'cat', typed: 2 })] });

    expect(screen.getByText('ca')).toHaveClass('text-primary');
    expect(screen.getByText('t')).not.toHaveClass('text-primary');
  });

  it('pauses falling when paused', () => {
    renderStage({ paused: true });

    expect(screen.getByTestId('rain-stage')).toHaveAttribute('data-paused', 'true');
  });

  it('shows the avatar pose of the phase', () => {
    const { container, rerender } = renderStage({ phase: 'won' });
    expect(bodyImage(container)?.getAttribute('src')).toMatch(/-win\.png$/);

    rerender(<RainStage drops={[]} avatar={DEFAULT_AVATAR} phase="playing" onLand={vi.fn()} />);
    expect(bodyImage(container)?.getAttribute('src')).toMatch(/-typing\.png$/);

    rerender(<RainStage drops={[]} avatar={DEFAULT_AVATAR} phase="playing" reaction={{ kind: 'shake', key: 1 }} onLand={vi.fn()} />);
    expect(bodyImage(container)?.getAttribute('src')).toMatch(/-lose\.png$/);
  });

  it('plays the reaction motion on the avatar', () => {
    renderStage({ reaction: { kind: 'hop', key: 1 } });

    expect(screen.getByTestId('avatar-motion')).toHaveClass('rain-hop');
  });

  it('slides the avatar under the targeted drop', () => {
    renderStage({ drops: [drop({ id: 'a', x: 20 })], targetId: 'a' });

    expect(screen.getByTestId('avatar-slot').style.left).toContain('20%');
  });

  it('renders an empty stage with only the avatar', () => {
    const { container } = renderStage();

    expect(screen.getByRole('img', { name: 'Avatar' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid^="fall-"]')).toHaveLength(0);
  });

  it('renders two drops with the same text', () => {
    const { container } = renderStage({ drops: [drop({ id: 'a', text: 'same' }), drop({ id: 'b', text: 'same', x: 70 })] });

    expect(container.querySelectorAll('[data-testid^="fall-"]')).toHaveLength(2);
  });

  it('fades typed and missed drops out instead of keeping them as falling words', () => {
    renderStage({ drops: [drop({ id: 'p', state: 'popped' }), drop({ id: 'm', state: 'missed' }), drop({ id: 'f' })] });

    expect(screen.getByTestId('tile-p')).toHaveClass('rain-gone');
    expect(screen.getByTestId('tile-m')).toHaveClass('rain-gone', 'text-destructive');
    expect(screen.getByTestId('tile-f')).not.toHaveClass('rain-gone');
  });
});
