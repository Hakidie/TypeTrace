import type { ReactNode } from 'react';
import { Keyboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/shared/components/ui/theme-toggle';

interface BrandHeaderProps {
  /** Where the logo links to. */
  to?: string;
  /** Navigation shown in the center of the header. */
  nav?: ReactNode;
  /** Show the theme toggle (default). The signed-in layout hides it: Mode is in the user menu. */
  themeToggle?: boolean;
  /** Extra controls shown on the right, after the theme toggle (e.g. Logout and the avatar). */
  children?: ReactNode;
}

/** Top bar: the TypeTrace logo on the left, `nav` in the center, the theme toggle and `children` on the right. Bottom border is 1px. */
export const BrandHeader = ({ to = '/', nav, themeToggle = true, children }: BrandHeaderProps) => (
  <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-3 md:px-8">
    <Link to={to} className="flex items-center gap-2 justify-self-start text-lg font-bold">
      <span className="inline-flex size-9 items-center justify-center bg-destructive text-destructive-foreground">
        <Keyboard className="size-5" />
      </span>
      TypeTrace
    </Link>
    <div className="col-start-2">{nav}</div>
    <div className="col-start-3 flex items-center gap-2 justify-self-end">
      {themeToggle && <ThemeToggle />}
      {children}
    </div>
  </header>
);
