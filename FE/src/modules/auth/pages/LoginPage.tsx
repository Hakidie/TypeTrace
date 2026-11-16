import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trans } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../api/auth.api';
import { useFinishLogin } from '../hooks/use-finish-login';
import { AuthInput } from '../components/AuthInput';
import { SocialButtons } from '../components/SocialButtons';
import { useFormShake } from '../hooks/use-form-shake';
import { getApiErrorBody, getApiErrorMessage } from '@/shared/api/api-error';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { FormField } from '@/shared/components/form-field';
import { cn } from '@/shared/lib/utils';
import { OtpInput } from '@/shared/components/ui/otp-input';

type FormValues = { email: string; password: string };

export const LoginPage = () => {
  const { t } = useTranslation('auth');
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().min(1, t('errors.emailRequired')).email(t('errors.emailInvalid')),
        password: z.string().min(6, t('errors.passwordShort')),
      }),
    [t],
  );
  const [step, setStep] = useState<'login' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
  });
  const finishLogin = useFinishLogin();
  const { shake, shakeProps } = useFormShake();

  const onLoginSubmit = handleSubmit(async (values) => {
    setLoading(true);
    try {
      const response = await authApi.login({ email: values.email, password: values.password });
      if ('token' in response) {
        await finishLogin(response.token);
        return;
      }
      setEmail(values.email);
      setStep('verify');
      toast.success(t('login.otpSent'));
    } catch (error) {
      const body = getApiErrorBody(error);
      if (body?.requiresOtp) {
        setEmail(body.email ?? values.email);
        setStep('verify');
        toast.info(t('login.otpRequired'));
      } else {
        toast.error(body?.message ?? t('errors.generic'));
        shake();
      }
    } finally {
      setLoading(false);
    }
  }, shake);

  const onVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const response = await authApi.verifyLoginOtp(email, otp);
      await finishLogin(response.token);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('errors.invalidOtp')));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <Card>
        <CardHeader className="pb-6 pt-0 text-center">
          <CardTitle>{t('login.verifyTitle')}</CardTitle>
          <CardDescription>
            <Trans t={t} i18nKey="login.verifyDescription" values={{ email }} components={{ strong: <span className="font-medium text-foreground" /> }} />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onVerifySubmit}>
            <OtpInput value={otp} onChange={setOtp} />
            <Button className="w-full" type="submit" disabled={otp.length !== 6 || loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t('login.verifySubmit')}
            </Button>
            <button
              type="button"
              onClick={() => { setStep('login'); setOtp(''); }}
              className="block w-full text-center text-base text-muted-foreground transition hover:text-foreground"
            >
              {t('login.backToLogin')}
            </button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-6 pt-0 text-center">
        <CardTitle>{t('login.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className={cn('space-y-3', shakeProps.className)} onAnimationEnd={shakeProps.onAnimationEnd} onSubmit={onLoginSubmit}>
          <FormField hideLabel id="email" label={t('fields.email')} error={errors.email?.message}>
            <AuthInput id="email" placeholder={t('fields.email')} aria-invalid={!!errors.email} {...register('email')} />
          </FormField>

          <FormField
            hideLabel
            id="password"
            label={t('fields.password')}
            error={errors.password?.message}
          >
            <AuthInput
              id="password"
              type="password"
              placeholder={t('fields.password')}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </FormField>

          <Button className="mt-6 h-12 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {t('login.submit')}
          </Button>
          <Button asChild variant="outline" className="mt-6 h-12 w-full">
            <Link to="/register">{t('login.createAccount')}</Link>
          </Button>
        </form>
        <div className="mt-6">
          <SocialButtons />
        </div>
        <div className="mt-6 text-right text-sm text-muted-foreground">
          <Link to="/forgot-password" className="transition hover:text-foreground">
            {t('login.forgot')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
