import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthInput } from '../components/AuthInput';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { SocialButtons } from '../components/SocialButtons';
import { useFormShake } from '../hooks/use-form-shake';
import { authApi } from '../api/auth.api';
import { useEmailExists } from '../hooks/use-email-exists';
import { useFinishLogin } from '../hooks/use-finish-login';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { FormField } from '@/shared/components/form-field';
import { cn } from '@/shared/lib/utils';
import { OtpInput } from '@/shared/components/ui/otp-input';

const registerSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof registerSchema>;

export const RegisterPage = () => {
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, getValues, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
  });
  const emailValue = watch('email') ?? '';
  const { exists: emailTaken } = useEmailExists(emailValue);
  const navigate = useNavigate();
  const finishLogin = useFinishLogin();
  const { shake, shakeProps } = useFormShake();

  /** Signs the new account in with the password just entered; false when that did not work. */
  const signIn = async () => {
    try {
      const response = await authApi.login({ email, password: getValues('password') });
      if (!('token' in response)) return false;
      await finishLogin(response.token, { newAccount: true });
      return true;
    } catch {
      return false;
    }
  };

  const onRegisterSubmit = handleSubmit(async (values) => {
    setLoading(true);
    try {
      await authApi.register({ email: values.email, password: values.password });
      setEmail(values.email);
      setStep('verify');
      toast.success('OTP sent to your email.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Something went wrong'));
      shake();
    } finally {
      setLoading(false);
    }
  }, shake);

  const onVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      await authApi.verifyRegisterOtp(email, otp);
      // Verified: sign in right away, so the new learner lands on the typing page, which asks them to take the placement
      // test (SCRUM-157). If that fails, the account is still verified and the login page opens instead.
      if (await signIn()) return;
      toast.success('Account verified! You can login now.');
      navigate('/login');
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
          <CardTitle>Confirm OTP</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onVerifySubmit}>
            <OtpInput value={otp} onChange={setOtp} />
            <Button className="w-full" type="submit" disabled={otp.length !== 6 || loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Verify OTP
            </Button>
            <button
              type="button"
              onClick={() => { setStep('register'); setOtp(''); }}
              className="block w-full text-center text-base text-muted-foreground transition hover:text-foreground"
            >
              Back to register
            </button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-6 pt-0 text-center">
        <CardTitle>Register</CardTitle>
      </CardHeader>
      <CardContent>
        <form className={cn('space-y-3', shakeProps.className)} onAnimationEnd={shakeProps.onAnimationEnd} onSubmit={onRegisterSubmit}>
          <FormField hideLabel id="email" label="Email" error={errors.email?.message}>
            <AuthInput
              id="email"
              placeholder="Email"
              aria-invalid={!!errors.email || emailTaken}
              warning={emailTaken ? 'This email already has an account. Log in instead.' : undefined}
              {...register('email')}
            />
          </FormField>

          <FormField hideLabel id="password" label="Password" error={errors.password?.message}>
            <AuthInput
              id="password"
              type="password"
              placeholder="Password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            <PasswordStrengthMeter password={watch('password') ?? ''} />
          </FormField>

          <Button className="mt-6 h-12 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Register and Send OTP
          </Button>
          <Button asChild variant="outline" className="mt-6 h-12 w-full">
            <Link to="/login">Log in to your account</Link>
          </Button>
        </form>
        <div className="mt-6">
          <SocialButtons />
        </div>
      </CardContent>
    </Card>
  );
};
