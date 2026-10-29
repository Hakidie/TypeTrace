import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TutorialBubble } from './TutorialBubble';

const renderBubble = (props: Partial<Parameters<typeof TutorialBubble>[0]> = {}) => {
  const onNext = vi.fn();
  const onSkip = vi.fn();
  render(
    <TutorialBubble step={2} total={6} label="Chuyến hướng dẫn" onNext={onNext} onSkip={onSkip} {...props}>
      Gõ đoạn văn này.
    </TutorialBubble>,
  );
  return { onNext, onSkip };
};

describe('TutorialBubble', () => {
  it('shows the step and the words of Ping', () => {
    renderBubble();

    const bubble = screen.getByRole('dialog', { name: 'Chuyến hướng dẫn' });
    expect(bubble).toHaveTextContent('2/6');
    expect(bubble).toHaveTextContent('Gõ đoạn văn này.');
  });

  it('goes on or skips by click', () => {
    const { onNext, onSkip } = renderBubble({ nextLabel: 'Đi thôi', skipLabel: 'Bỏ qua hướng dẫn' });

    fireEvent.click(screen.getByRole('button', { name: 'Đi thôi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' }));

    expect(onNext).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('goes on with Enter, but not while typing in a box', () => {
    const { onNext } = renderBubble();
    const box = document.createElement('input');
    document.body.append(box);

    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onNext).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(onNext).toHaveBeenCalledOnce();
    box.remove();
  });

  it('goes on once when Enter presses the focused next button', () => {
    const { onNext } = renderBubble();
    const next = screen.getByRole('button', { name: 'Tiếp' });
    next.focus();

    // The browser clicks a focused button on Enter; the shortcut must not count it a second time.
    fireEvent.keyDown(next, { key: 'Enter' });
    fireEvent.click(next);

    expect(onNext).toHaveBeenCalledOnce();
  });

  it('has no next button while Ping waits for the learner', () => {
    renderBubble({ onNext: undefined });

    expect(screen.queryByRole('button', { name: 'Tiếp' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Bỏ qua' })).toBeInTheDocument();
  });
});
