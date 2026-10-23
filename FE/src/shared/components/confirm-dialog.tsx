import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Red confirm button, for deletes. */
  destructive?: boolean;
  /** Disables the buttons and shows a spinner while the action runs. */
  pending?: boolean;
  /** Disables only the confirm button, e.g. until a required field inside is filled. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  /** Where the focus goes when the dialog closes: call `event.preventDefault()` and focus something else (the default is the element that was focused before). */
  onCloseAutoFocus?: (event: Event) => void;
  /** Shown between the description and the buttons, e.g. a field for the reason of a decision. */
  children?: ReactNode;
}

/** "Are you sure?" dialog. Close it from `onConfirm` once the action succeeds. */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  pending = false,
  confirmDisabled = false,
  onConfirm,
  onCloseAutoFocus,
  children,
}: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {children}
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant={destructive ? 'destructive' : 'default'} disabled={pending || confirmDisabled} onClick={onConfirm}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
