import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '@/modules/settings/hooks/use-theme-mode';
import { Button } from '@/shared/components/ui/button';

/** Switches between Light and Dark mode. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useThemeMode();
  const label = mode === 'dark' ? t('menu.dark') : t('menu.light');
  const Icon = mode === 'dark' ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      title={t('theme.mode', { mode: label })}
      aria-label={t('theme.switch', { mode: label })}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
