import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

const renderDialog = (props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(<ConfirmDialog open title="Reject it?" description="The learner sees why." confirmLabel="Reject" onConfirm={onConfirm} onOpenChange={onOpenChange} {...props} />);
  return { onConfirm, onOpenChange };
};

describe('ConfirmDialog', () => {
  it('asks, then confirms or cancels', () => {
    const { onConfirm, onOpenChange } = renderDialog();

    expect(screen.getByRole('dialog', { name: 'Reject it?' })).toHaveTextContent('The learner sees why.');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows extra content between the description and the buttons, and can keep only the confirm button off', () => {
    const { onConfirm } = renderDialog({ children: <textarea aria-label="Reason" />, confirmDisabled: true });

    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('can name the button that closes it, e.g. Not now', () => {
    const { onOpenChange } = renderDialog({ cancelLabel: 'Not now' });

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('turns both buttons off while the action runs', () => {
    renderDialog({ pending: true });

    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
