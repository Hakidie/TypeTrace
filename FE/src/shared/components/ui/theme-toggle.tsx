import { Moon, Sun } from 'lucide-react';
import { useThemeMode } from '@/modules/settings/hooks/use-theme-mode';
import { Button } from '@/shared/components/ui/button';

/** Switches between Light and Dark mode. */
export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();
  const label = mode === 'dark' ? 'Dark' : 'Light';
  const Icon = mode === 'dark' ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      title={`Mode: ${label}`}
      aria-label={`Switch mode (current: ${label})`}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
