import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PassageView } from './PassageView';

const words = ['gõ', 'nhanh', 'hơn'];

describe('PassageView font size', () => {
  it('is 2rem and 9.25rem high with 3 rows when no size is given', () => {
    render(<PassageView words={words} results={[]} maxRows={3} />);

    const passage = screen.getByLabelText('Passage to type');
    expect(passage.style.fontSize).toBe('2rem');
    expect(passage.style.height).toBe('9.25rem');
  });

  it('follows fontSizeRem: 1rem text in a 5.125rem high box', () => {
    render(<PassageView words={words} results={[]} maxRows={3} fontSizeRem={1} />);

    const passage = screen.getByLabelText('Passage to type');
    expect(passage.style.fontSize).toBe('1rem');
    expect(passage.style.height).toBe('5.125rem');
  });

  it('draws the caret as tall as the font size', () => {
    const { container } = render(<PassageView words={words} results={[]} current="" fontSizeRem={2.5} maxRows={3} />);

    const caret = container.querySelector('.animate-pulse') as HTMLElement;
    expect(caret.style.height).toBe('2.5rem');
  });
});
