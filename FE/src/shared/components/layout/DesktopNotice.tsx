import { Monitor, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@/shared/hooks/use-media-query';

const STORAGE_KEY = 'typetrace.desktopNoticeDismissed';

const wasDismissed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

/** A strip under the header on phones and tablets (below `lg`): TypeTrace is best on a desktop with a keyboard. The close button is remembered in this browser. */
export const DesktopNotice = () => {
  const { t } = useTranslation();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (desktop || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Storage blocked: the notice only stays closed until the page is opened again.
    }
  };

  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b bg-primary/10 px-4 py-2 text-sm text-foreground">
      <Monitor className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{t('desktopNotice.text')}</span>
      <button type="button" onClick={dismiss} aria-label={t('desktopNotice.dismiss')} className="ml-1 inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
};
