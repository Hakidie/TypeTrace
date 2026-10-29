import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lottie } from './lottie';

const props = vi.fn();

// The player draws on a canvas, which the test DOM has not: record what it is asked to play instead.
vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: (received: Record<string, unknown>) => {
    props(received);
    return <div data-testid="player" />;
  },
}));

const reduceMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

describe('Lottie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    props.mockReset();
  });

  it('plays the named animation from public/lottie', () => {
    reduceMotion(false);
    render(<Lottie name="trophy" />);

    expect(props).toHaveBeenLastCalledWith(expect.objectContaining({ src: '/lottie/trophy.lottie', autoplay: true, loop: false }));
  });

  it('loops when asked', () => {
    reduceMotion(false);
    render(<Lottie name="fire-streak" loop />);

    expect(props).toHaveBeenLastCalledWith(expect.objectContaining({ src: '/lottie/fire-streak.lottie', loop: true }));
  });

  it('stays still for reduced motion', () => {
    reduceMotion(true);
    render(<Lottie name="confetti" />);

    expect(props).toHaveBeenLastCalledWith(expect.objectContaining({ autoplay: false, loop: false }));
  });

  it('waits until it is told to play', () => {
    reduceMotion(false);
    render(<Lottie name="trophy" play={false} />);

    expect(props).toHaveBeenLastCalledWith(expect.objectContaining({ autoplay: false }));
  });

  it('is hidden from screen readers', () => {
    reduceMotion(false);
    const { container } = render(<Lottie name="trophy" />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
