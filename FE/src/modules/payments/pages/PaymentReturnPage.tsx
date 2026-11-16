import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, Crown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { tokenStore } from '@/modules/auth/store/token.store';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { useAvatarCatalog, useUpdateAvatar } from '@/modules/avatar/hooks/use-avatar';
import type { AvatarLook, AvatarSlot } from '@/modules/avatar/types/avatar.types';
import { LoadingState } from '@/shared/components/loading-state';
import { Lottie } from '@/shared/components/lottie';
import { BrandFooter } from '@/shared/components/layout/BrandFooter';
import { BrandHeader } from '@/shared/components/layout/BrandHeader';
import { Button } from '@/shared/components/ui/button';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { CountUp } from '../components/CountUp';
import { useVnpayReturn } from '../hooks/use-payments';
import { failureMessage, formatCoins, momoFailureMessage, payosFailureMessage } from '../lib/store';
import type { PaymentProvider, VnpayReturn } from '../types/payments.types';

const SLOT_ORDER: AvatarSlot[] = ['headwear', 'accessory', 'back', 'effect'];
/** A stable function for `CountUp`: `+1.400 coins`. */
const formatGain = (coins: number) => `+${formatCoins(coins)}`;
const dateText = (iso: string, language: string) => new Date(iso).toLocaleDateString(language.startsWith('vi') ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** After a Premium payment: the avatar already wearing the set, and a button that puts it on for good. Only when the set has sprites. */
const WearProSet = () => {
  const { t } = useTranslation('store');
  const catalog = useAvatarCatalog();
  const updateAvatar = useUpdateAvatar();
  if (!catalog.data) return null;

  const proItems = SLOT_ORDER.flatMap((slot) => catalog.data.slots[slot].filter((item) => item.unlock.kind === 'premium' && item.owned).map((item) => ({ slot, id: item.id })));
  if (proItems.length === 0) return null;
  const look: AvatarLook = { ...catalog.data.avatar, ...Object.fromEntries(proItems.map(({ slot, id }) => [slot, id])) };
  const worn = proItems.every(({ slot, id }) => catalog.data.avatar[slot] === id);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex justify-center border-b border-primary/30 bg-primary/5 px-10 pt-2">
        <AvatarSprite look={look} pose="win" scale={5} label={t('ret.wearSet')} />
      </div>
      {!worn && (
        <Button type="button" disabled={updateAvatar.isPending} onClick={() => updateAvatar.mutate(look)}>
          {t('ret.wear')}
        </Button>
      )}
    </div>
  );
};

const Paid = ({ result, signedIn }: { result: VnpayReturn; signedIn: boolean }) => {
  const { t, i18n } = useTranslation('store');
  const user = useCurrentUser();
  const grant = result.grant;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Confetti plays once in a space of its own above the title (its popper never covers the text): it marks that the
          payment worked, and carries no information itself. The check is drawn on it. */}
      <div className="relative grid size-40 place-items-center">
        <Lottie name="confetti" className="absolute inset-0 size-full" />
        <CircleCheck className="relative size-10 text-primary" aria-hidden="true" />
      </div>
      {grant?.kind === 'coins' ? (
        <>
          <h1 className="text-3xl font-semibold">{t('ret.complete')}</h1>
          <p className="text-4xl font-semibold text-primary">
            <CountUp to={grant.coins} format={formatGain} />
          </p>
          {signedIn && user.data?.coins !== undefined && <p className="text-muted-foreground">{t('ret.balance', { coins: formatCoins(user.data.coins) })}</p>}
        </>
      ) : (
        <>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            {t('ret.premiumNow')} <Crown className="size-7 text-primary" aria-hidden="true" />
          </h1>
          {signedIn && user.data?.premium?.until && <p className="text-muted-foreground">{t('ret.until', { date: dateText(user.data.premium.until, i18n.language) })}</p>}
          {signedIn && <WearProSet />}
        </>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {signedIn ? (
          <>
            <Button asChild>
              <Link to="/wardrobe">{t('ret.openWardrobe')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/store">{grant?.kind === 'coins' ? t('ret.buyMore') : t('ret.backStore')}</Link>
            </Button>
          </>
        ) : (
          <Button asChild>
            <Link to="/login">{t('ret.logIn')}</Link>
          </Button>
        )}
      </div>
    </div>
  );
};

const Trouble = ({ title, text }: { title: string; text: string }) => {
  const { t } = useTranslation('store');
  return (
  <div className="flex flex-col items-center gap-4">
    <CircleAlert className="size-10 text-muted-foreground" aria-hidden="true" />
    <h1 className="text-3xl font-semibold">{title}</h1>
    <p className="max-w-md text-muted-foreground">{text}</p>
    <Button asChild>
      <Link to="/store">{t('ret.backStore')}</Link>
    </Button>
  </div>
  );
};

/**
 * Where VNPay sends the browser back (`/payments/vnpay/return`, public: the checksum is the proof, a learner whose login
 * ended can still see the result). It asks the server to confirm what VNPay sent, then shows the outcome.
 * `MomoReturnPage` and `PayosReturnPage` are the same page for MoMo and payOS (payOS's query is not signed: the server asks payOS).
 */
export const PaymentReturnPage = ({ provider = 'vnpay' }: { provider?: PaymentProvider }) => {
  const { t } = useTranslation('store');
  const { search } = useLocation();
  const result = useVnpayReturn(search, provider);
  const signedIn = Boolean(tokenStore.get());
  const query = new URLSearchParams(search);
  const gateway = { vnpay: 'VNPay', momo: 'MoMo', payos: 'payOS' }[provider];
  const failure = {
    vnpay: () => failureMessage(query.get('vnp_ResponseCode')),
    momo: () => momoFailureMessage(query.get('resultCode')),
    payos: () => payosFailureMessage(query.get('cancel')),
  }[provider]();

  return (
    <div className={`flex min-h-screen flex-col overflow-x-clip ${redGlassTheme}`}>
      <BrandHeader to="/">
        {!signedIn && (
          <Button asChild variant="ghost">
            <Link to="/login">{t('ret.login')}</Link>
          </Button>
        )}
      </BrandHeader>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        {result.isLoading && (
          <div role="status" className="flex flex-col items-center gap-4">
            <LoadingState rows={2} />
            <p className="text-muted-foreground">{t('ret.confirming', { gateway })}</p>
          </div>
        )}
        {result.isError && (
          <Trouble
            title={t('ret.cannotVerify')}
            text={t('ret.cannotVerifyHint', { gateway })}
          />
        )}
        {result.data?.status === 'paid' && <Paid result={result.data} signedIn={signedIn} />}
        {result.data?.status === 'failed' && <Trouble title={t('ret.notCompleted')} text={failure} />}
        {result.data?.status === 'pending' && <Trouble title={t('ret.waiting', { gateway })} text={t('ret.waitingHint')} />}
      </main>
      <BrandFooter />
    </div>
  );
};

export const MomoReturnPage = () => <PaymentReturnPage provider="momo" />;
export const PayosReturnPage = () => <PaymentReturnPage provider="payos" />;
