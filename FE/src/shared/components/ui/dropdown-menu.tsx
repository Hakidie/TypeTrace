import * as React from 'react';
import { cn } from '@/shared/lib/utils';

// Custom dropdown using React state — no Radix dependency needed

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
});

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = React.useContext(DropdownMenuContext);

  return (
    <button
      type="button"
      className={cn('inline-flex items-center', className)}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      {...props}
    >
      {children}
    </button>
  );
}

function DropdownMenuContent({ children, className, align = 'start', ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' }) {
  const { open, setOpen } = React.useContext(DropdownMenuContext);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        // Same look as `Panel`: page background (see-through, blurred) and the soft red border on hover.
        'absolute z-50 mt-1 min-w-[8rem] overflow-hidden border border-border bg-background/80 p-1 text-popover-foreground shadow-md backdrop-blur-md transition-colors hover:border-destructive/40 animate-in fade-in-0 zoom-in-95',
        align === 'end' ? 'right-0' : 'left-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuItem({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { setOpen } = React.useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e);
    setOpen(false);
  };

  return (
    <div
      role="menuitem"
      className={cn(
        'relative flex cursor-pointer select-none items-center px-2 py-1.5 text-base text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};
