import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { authApi } from '../api/auth.api';
import { AuthInput } from '../components/AuthInput';
import { useFormShake } from '../hooks/use-form-shake';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { FormField } from '@/shared/components/form-field';
import { cn } from '@/shared/lib/utils';

type RequestValues = { email: string };
type ResetValues = { email?: string; token: string; newPassword: string };

export const ForgotPasswordPage = () => {
  const { t } = useTranslation('auth');
  const requestSchema = useMemo(() => z.object({ email: z.string().min(1, t('errors.emailRequired')).email(t('errors.emailInvalid')) }), [t]);
  const resetSchema = useMemo(
    () =>
      z.object({
        email: z.string().optional(),
        token: z.string().min(1, t('errors.tokenRequired')),
        newPassword: z.string().min(6, t('errors.passwordShort')),
      }),
    [t],
  );
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');

  const { shake, shakeProps } = useFormShake();

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
  });
  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
  });

  const onRequestToken = requestForm.handleSubmit(async (values) => {
    try {
      await authApi.forgotPassword(values.email);
      setEmail(values.email);
      setStep('reset');
      toast.success(t('forgot.tokenSent'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('errors.generic')));
      shake();
    }
  }, shake);

  const onResetPassword = resetForm.handleSubmit(async (values) => {
    try {
      await authApi.resetPassword(email || values.email || '', values.token, values.newPassword);
      toast.success(t('forgot.resetDone'));
      setStep('request');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('errors.generic')));
      shake();
    }
  }, shake);

  return (
    <Card>
      <CardHeader className="pb-6 pt-0 text-center">
        <CardTitle>{step === 'request' ? t('forgot.requestTitle') : t('forgot.resetTitle')}</CardTitle>
        <CardDescription>
          {step === 'request'
            ? t('forgot.requestDescription')
            : t('forgot.resetDescription', { email })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'request' ? (
          <form className={cn('space-y-3', shakeProps.className)} onAnimationEnd={shakeProps.onAnimationEnd} onSubmit={onRequestToken}>
            <FormField hideLabel id="email" label={t('fields.email')} error={requestForm.formState.errors.email?.message}>
              <AuthInput
                id="email"
                placeholder={t('fields.email')}
                aria-invalid={!!requestForm.formState.errors.email}
                {...requestForm.register('email')}
              />
            </FormField>
            <Button className="mt-6 w-full" type="submit">{t('forgot.sendToken')}</Button>
          </form>
        ) : (
          <form className={cn('space-y-3', shakeProps.className)} onAnimationEnd={shakeProps.onAnimationEnd} onSubmit={onResetPassword}>
            <FormField hideLabel id="token" label={t('fields.resetToken')} error={resetForm.formState.errors.token?.message}>
              <AuthInput
                id="token"
                placeholder={t('fields.resetToken')}
                aria-invalid={!!resetForm.formState.errors.token}
                {...resetForm.register('token')}
              />
            </FormField>
            <FormField hideLabel id="newPassword" label={t('fields.newPassword')} error={resetForm.formState.errors.newPassword?.message}>
              <AuthInput
                id="newPassword"
                type="password"
                placeholder={t('fields.newPassword')}
                aria-invalid={!!resetForm.formState.errors.newPassword}
                {...resetForm.register('newPassword')}
              />
            </FormField>
            <Button className="mt-6 w-full" type="submit">{t('forgot.resetSubmit')}</Button>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('forgot.backToRequest')}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
