import { Outlet } from 'react-router-dom';
import { BrandFooter } from '@/shared/components/layout/BrandFooter';
import { BrandHeader } from '@/shared/components/layout/BrandHeader';
import { redGlassCard, redGlassTheme } from '@/shared/lib/red-glass-theme';

// Auth pages only (login, register, forgot password); the rest of the app keeps its theme.
// The theme (blurred red glass card, maroon fields, blood-red dark mode) lives in shared/lib/red-glass-theme.ts.
export const AuthLayout = () => (
  <div className={`flex min-h-screen flex-col ${redGlassTheme}`}>
    <BrandHeader to="/login" />

    <main className="flex flex-1 items-center justify-center p-4">
      {/* The page's card is the direct child: semi-transparent with a blurred backdrop. */}
      <div className={`w-full max-w-md ${redGlassCard}`}>
        <Outlet />
      </div>
    </main>

    <BrandFooter />
  </div>
);
