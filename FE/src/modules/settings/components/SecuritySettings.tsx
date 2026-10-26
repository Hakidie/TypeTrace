import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { profileApi } from '@/modules/profile/api/profile.api';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

interface SecuritySettingsProps {
  user: CurrentUser;
}

/** Lets the user turn the emailed login code (second login step) on or off. In the Security panel of the Settings page. */
export const SecuritySettings = ({ user }: SecuritySettingsProps) => {
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
      toast.error(getApiErrorMessage(error, 'Could not update the setting.'));
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserKey, updated);
      toast.success(
        updated.loginOtpEnabled
          ? 'Login now asks for a code sent to your email.'
          : 'Login no longer asks for an email code.',
      );
    },
  });

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="login-otp">Email code at login</Label>
        <p className="text-base text-muted-foreground">
          After your password, ask for a 6-digit code sent to {user.email}.
        </p>
      </div>
      <Switch
        id="login-otp"
        checked={user.loginOtpEnabled}
        disabled={toggleLoginOtp.isPending}
        onCheckedChange={(checked) => toggleLoginOtp.mutate(checked)}
      />
    </div>
  );
};
