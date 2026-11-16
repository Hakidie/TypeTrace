import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { profileApi } from '@/modules/profile/api/profile.api';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Panel } from '@/shared/components/panel';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { Switch } from '@/shared/components/ui/switch';

interface SecuritySettingsProps {
  user: CurrentUser;
}

/** Lets the user turn the emailed login code (second login step) on or off. The Security tab of the Settings page. */
export const SecuritySettings = ({ user }: SecuritySettingsProps) => {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();

  // Optimistic update: the switch flips immediately and flips back if the request fails.
  const toggleLoginOtp = useMutation({
    mutationFn: (loginOtpEnabled: boolean) => profileApi.updateSecurity({ loginOtpEnabled }),
    onMutate: async (loginOtpEnabled) => {
      await queryClient.cancelQueries({ queryKey: currentUserKey });
      const previous = queryClient.getQueryData<CurrentUser>(currentUserKey);
      if (previous) queryClient.setQueryData(currentUserKey, { ...previous, loginOtpEnabled });
      return { previous };
    },
    onError: (error, _loginOtpEnabled, context) => {
      if (context?.previous) queryClient.setQueryData(currentUserKey, context.previous);
      toast.error(getApiErrorMessage(error, t('security.saveFailed')));
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserKey, updated);
      toast.success(
        updated.loginOtpEnabled ? t('security.turnedOn') : t('security.turnedOff'),
      );
    },
  });

  const description = t('security.description', { email: user.email });

  // A title (its tooltip has the description too); under it the description and, on the right, the switch.
  return (
    <Panel title={t('security.title')} titleTip={description} bare titleClassName={sectionTitleClass} className="flex items-center justify-between gap-4 pt-3">
      <p className="text-lg text-muted-foreground">{description}</p>
      <Switch
        id="login-otp"
        aria-label={t('security.title')}
        checked={user.loginOtpEnabled}
        disabled={toggleLoginOtp.isPending}
        onCheckedChange={(checked) => toggleLoginOtp.mutate(checked)}
      />
    </Panel>
  );
};
