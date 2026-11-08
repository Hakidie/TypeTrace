import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { authApi } from '../api/auth.api';
import { useFinishLogin } from '../hooks/use-finish-login';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

const loadGoogleScript = () =>
  new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = (window as unknown as { google?: GoogleIdentity }).google;
    if (existing?.accounts) return resolve(existing);

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT;
    script.async = true;
    script.onload = () => resolve((window as unknown as { google: GoogleIdentity }).google);
    script.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(script);
  });

const GoogleG = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-5 fill-current">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
  </svg>
);

/** Google's own icon button is 40x40 (`type: 'icon'`); it is stretched invisibly over the cell so the whole cell is its click target. */
const GOOGLE_ICON_PX = 40;
const CELL_HEIGHT_PX = 48;

/**
 * The "Continue with Google" icon button, one cell of `SocialButtons`: it fills its cell. Without `VITE_GOOGLE_CLIENT_ID` it is
 * still shown but explains it is not set up. With it, Google's own button (which cannot be resized) is rendered, scaled up and
 * invisible, over our square button, so a click on the cell reaches Google.
 */
export const GoogleSignInButton = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const cell = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [cellWidth, setCellWidth] = useState(GOOGLE_ICON_PX);
  const finishLogin = useFinishLogin();

  useEffect(() => {
    const element = cell.current;
    if (!element || !clientId || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setCellWidth(element.clientWidth || GOOGLE_ICON_PX));
    observer.observe(element);
    return () => observer.disconnect();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGoogleScript()
      .then((google) => {
        if (cancelled || !container.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            try {
              // A first Google login creates the account: the typing page then asks to take the placement test.
              const { token, isNewUser } = await authApi.googleLogin(credential);
              await finishLogin(token, { newAccount: isNewUser });
            } catch (error) {
              toast.error(getApiErrorMessage(error, 'Google login failed'));
            }
          },
        });
        google.accounts.id.renderButton(container.current, {
          theme: 'outline',
          size: 'large',
          type: 'icon',
          shape: 'square',
        });
      })
      .catch(() => toast.error('Could not load Google sign-in'));

    return () => {
      cancelled = true;
    };
    // finishLogin changes every render; the Google callback only needs the latest at click time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <div ref={cell} className="relative h-12 w-full">
      <Button
        type="button"
        variant="outline"
        aria-label="Continue with Google"
        className="size-full p-0 hover:bg-destructive/90 hover:text-destructive-foreground"
        onClick={clientId ? undefined : () => toast.info('Google login is not set up yet. Add VITE_GOOGLE_CLIENT_ID to FE/.env.')}
      >
        <GoogleG />
      </Button>
      {clientId && (
        <div
          ref={container}
          className="absolute left-0 top-0 origin-top-left opacity-[0.01]"
          style={{ transform: `scale(${cellWidth / GOOGLE_ICON_PX}, ${CELL_HEIGHT_PX / GOOGLE_ICON_PX})` }}
        />
      )}
    </div>
  );
};
