import type { ReactNode } from 'react';
import { Keyboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/shared/components/ui/theme-toggle';

interface BrandHeaderProps {
  /** Where the logo links to. */
  to?: string;
  /** Extra controls shown on the right, before the theme toggle. */
  children?: ReactNode;
}

/** Top bar with the TypeTrace logo on the left and the theme toggle on the right. Bottom border is 1px. */
export const BrandHeader = ({ to = '/', children }: BrandHeaderProps) => (
  <header className="flex items-center justify-between border-b px-4 py-3 md:px-8">
    <Link to={to} className="flex items-center gap-2 text-lg font-bold">
      <span className="inline-flex size-9 items-center justify-center bg-destructive text-destructive-foreground">
        <Keyboard className="size-5" />
      </span>
      TypeTrace
    </Link>
    <div className="flex items-center gap-2">
      {children}
      <ThemeToggle />
    </div>
  </header>
);
