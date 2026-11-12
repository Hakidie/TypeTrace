import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { Gamepad2, Keyboard, Trophy } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { TabGroup } from './tab-group';

const tabs = [
  { value: 'practice', label: 'Practice', icon: Keyboard },
  { value: 'rank', label: 'Rank', icon: Trophy },
  { value: 'minigames', label: 'Minigames', icon: Gamepad2 },
  { value: 'plain', label: 'No icon' },
];

describe('TabGroup', () => {
  it('marks the selected tab and reports a click', async () => {
    const onChange = vi.fn();
    render(<TabGroup label="Mode" tabs={tabs} value="rank" onChange={onChange} />);

    expect(screen.getByRole('radio', { name: 'Rank' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Practice' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('radio', { name: 'Minigames' }));

    expect(onChange).toHaveBeenCalledWith('minigames');
  });

  it('keeps every label on screen by default', () => {
    render(<TabGroup label="Mode" tabs={tabs} value="rank" onChange={() => undefined} />);

    expect(screen.getByRole('radio', { name: 'Practice' }).querySelector('.max-sm\\:sr-only')).toBeNull();
  });

  it('shows only the icons of the other tabs on phones with iconsOnPhones, and keeps every label for screen readers', () => {
    render(<TabGroup label="Mode" tabs={tabs} value="rank" onChange={() => undefined} iconsOnPhones />);

    // Tests load no CSS: the phone rule is the `max-sm:sr-only` class of the label.
    expect(screen.getByText('Practice')).toHaveClass('max-sm:sr-only');
    expect(screen.getByText('Minigames')).toHaveClass('max-sm:sr-only');
    // The selected tab keeps its label, on one line; a tab without an icon keeps its label too.
    expect(screen.getByText('Rank')).not.toHaveClass('max-sm:sr-only');
    expect(screen.getByText('Rank')).toHaveClass('whitespace-nowrap');
    expect(screen.getByText('No icon')).not.toHaveClass('max-sm:sr-only');
    for (const name of ['Practice', 'Rank', 'Minigames', 'No icon']) expect(screen.getByRole('radio', { name })).toBeInTheDocument();
  });
});
