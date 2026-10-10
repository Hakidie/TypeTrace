import { Outlet } from 'react-router-dom';
import { BrandFooter } from '@/shared/components/layout/BrandFooter';
import { BrandHeader } from '@/shared/components/layout/BrandHeader';

// Auth pages only (login, register, forgot password); the rest of the app keeps its theme.
// Tailwind reads the `--color-*` variables, so those are the ones overridden here.
// The card is blurred red glass; fields and the Google button are solid maroon; the card has no visible border.
// Dark mode uses a blood-red palette: near-black red page, dark maroon fields, bright red accents.
export const AuthLayout = () => (
  <div className="flex min-h-screen flex-col bg-white text-foreground [--color-ring:var(--color-destructive)] [--color-background:rgb(255_255_255/0.6)] [--color-input:rgb(176_30_30/0.3)] dark:bg-[#140606] dark:[--color-background:#341414] dark:[--color-input:#341414] dark:[--color-border:#3a1616] dark:[--color-foreground:#e6d2d2] dark:[--color-muted-foreground:#a87878] dark:[--color-destructive:#b01e1e] dark:[--color-destructive-foreground:#f3dcdc]">
    <BrandHeader to="/login" />

    <main className="flex flex-1 items-center justify-center p-4">
      {/* The page's card is the direct child: semi-transparent with a blurred backdrop. */}
      <div className="w-full max-w-md [&>*]:border-transparent [&>*]:bg-destructive/10 [&>*]:backdrop-blur-md">
        <Outlet />
      </div>
    </main>

    <BrandFooter />
  </div>
);
