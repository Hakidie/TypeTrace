import { type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';

interface RowContextMenuProps {
  /** The name of the menu for screen readers, e.g. `Actions for Lan`. */
  label: string;
  /** The items of the menu: `DropdownMenuItem`s (a click on one closes the menu). */
  menu: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A list row whose actions are in a menu that opens where the right mouse button was pressed (and with the menu key or
 * Shift + F10 while the row has the focus), as well as the kebab button of the row. The menu has the look of
 * the dropdown menus and closes on a click, Escape, a scroll or another right click.
 */
export const RowContextMenu = ({ label, menu, children, className }: RowContextMenuProps) => {
  const [at, setAt] = useState<{ x: number; y: number }>();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(undefined);
    const outside = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    const escape = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [at]);

  const open = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    // From the keyboard the event has no pointer: the menu opens at the top left of the row.
    const box = event.currentTarget.getBoundingClientRect();
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    setAt({ x: fromKeyboard ? box.left : event.clientX, y: fromKeyboard ? box.top : event.clientY });
  };

  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      aria-haspopup="menu"
      onContextMenu={open}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault();
          const box = event.currentTarget.getBoundingClientRect();
          setAt({ x: box.left, y: box.top });
        }
      }}
      className={cn('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      {children}
      {at && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          style={{ left: at.x, top: at.y }}
          onClick={() => setAt(undefined)}
          // Same look as the dropdown menus: see-through page background with blur, the soft red border on hover.
          className="fixed z-50 min-w-[8rem] border border-border bg-background/75 p-1 text-popover-foreground shadow-md backdrop-blur-xs transition-colors hover:border-destructive/40 animate-in fade-in-0 zoom-in-95"
        >
          {menu}
        </div>
      )}
    </div>
  );
};
