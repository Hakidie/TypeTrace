import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof loginSchema>;

export const LoginPage = () => {
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
      toast.success('OTP has been sent to your email.');
    } catch (error) {
      const body = getApiErrorBody(error);
      if (body?.requiresOtp) {
        setEmail(body.email ?? values.email);
        setStep('verify');
        toast.info('OTP required. Check your email.');
      } else {
        toast.error(body?.message ?? 'Something went wrong');
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
      toast.error(getApiErrorMessage(error, 'Invalid OTP'));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <Card>
        <CardHeader className="pb-6 pt-0 text-center">
          <CardTitle>Verify OTP</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onVerifySubmit}>
            <OtpInput value={otp} onChange={setOtp} />
            <Button className="w-full" type="submit" disabled={otp.length !== 6 || loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Verify and Login
            </Button>
            <button
              type="button"
              onClick={() => { setStep('login'); setOtp(''); }}
              className="block w-full text-center text-base text-muted-foreground transition hover:text-foreground"
            >
              Back to login
            </button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-6 pt-0 text-center">
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form className={cn('space-y-3', shakeProps.className)} onAnimationEnd={shakeProps.onAnimationEnd} onSubmit={onLoginSubmit}>
          <FormField hideLabel id="email" label="Email" error={errors.email?.message}>
            <AuthInput id="email" placeholder="Email" aria-invalid={!!errors.email} {...register('email')} />
          </FormField>

          <FormField
            hideLabel
            id="password"
            label="Password"
            error={errors.password?.message}
          >
            <AuthInput
              id="password"
              type="password"
              placeholder="Password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </FormField>

          <Button className="mt-6 h-12 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </Button>
          <Button asChild variant="outline" className="mt-6 h-12 w-full">
            <Link to="/register">Create a new account</Link>
          </Button>
        </form>
        <div className="mt-6">
          <SocialButtons />
        </div>
        <div className="mt-6 text-right text-sm text-muted-foreground">
          <Link to="/forgot-password" className="transition hover:text-foreground">
            Forgot password?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
