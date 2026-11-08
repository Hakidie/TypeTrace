import { useState } from 'react';
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

const requestSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
});

const resetSchema = z.object({
  email: z.string().optional(),
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

type RequestValues = z.infer<typeof requestSchema>;
type ResetValues = z.infer<typeof resetSchema>;

export const ForgotPasswordPage = () => {
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
      toast.success('Reset token sent to your email.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Something went wrong'));
      shake();
    }
  }, shake);

  const onResetPassword = resetForm.handleSubmit(async (values) => {
    try {
      await authApi.resetPassword(email || values.email || '', values.token, values.newPassword);
      toast.success('Password reset successful. You can login now.');
      setStep('request');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Something went wrong'));
      shake();
    }
  }, shake);

  return (
    <Card>
      <CardHeader className="pb-6 pt-0 text-center">
        <CardTitle>{step === 'request' ? 'Forgot password' : 'Reset password'}</CardTitle>
        <CardDescription>
          {step === 'request'
            ? 'Enter your email to receive a reset token.'
            : `Enter the token sent to ${email} and your new password.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'request' ? (
          <form className={cn('space-y-3', shakeProps.className)} onAnimationEnd={shakeProps.onAnimationEnd} onSubmit={onRequestToken}>
            <FormField hideLabel id="email" label="Email" error={requestForm.formState.errors.email?.message}>
              <AuthInput
                id="email"
                placeholder="Email"
                aria-invalid={!!requestForm.formState.errors.email}
                {...requestForm.register('email')}
              />
            </FormField>
            <Button className="mt-6 w-full" type="submit">Send Reset Token</Button>
          </form>
        ) : (
          <form className={cn('space-y-3', shakeProps.className)} onAnimationEnd={shakeProps.onAnimationEnd} onSubmit={onResetPassword}>
            <FormField hideLabel id="token" label="Reset Token" error={resetForm.formState.errors.token?.message}>
              <AuthInput
                id="token"
                placeholder="Reset token"
                aria-invalid={!!resetForm.formState.errors.token}
                {...resetForm.register('token')}
              />
            </FormField>
            <FormField hideLabel id="newPassword" label="New Password" error={resetForm.formState.errors.newPassword?.message}>
              <AuthInput
                id="newPassword"
                type="password"
                placeholder="New password"
                aria-invalid={!!resetForm.formState.errors.newPassword}
                {...resetForm.register('newPassword')}
              />
            </FormField>
            <Button className="mt-6 w-full" type="submit">Reset Password</Button>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to request token
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
