import { useEffect, useRef } from 'react';
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

/** "Continue with Google" button. Without `VITE_GOOGLE_CLIENT_ID` it is still shown but explains it is not set up. */
export const GoogleSignInButton = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const container = useRef<HTMLDivElement>(null);
  const finishLogin = useFinishLogin();

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
          text: 'continue_with',
          width: container.current.clientWidth,
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
    <>
      <div className="my-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      {clientId ? (
        <div ref={container} className="flex w-full justify-center" />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full hover:bg-destructive/90 hover:text-destructive-foreground"
          onClick={() => toast.info('Google login is not set up yet. Add VITE_GOOGLE_CLIENT_ID to FE/.env.')}
        >
          Continue with Google
        </Button>
      )}
    </>
  );
};
