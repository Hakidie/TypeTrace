import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@typetrace/shared';
import { KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../api/auth.api';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

const requestSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
});

const resetSchema = z.object({
  email: z.string().optional(),
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
});

type RequestValues = z.infer<typeof requestSchema>;
type ResetValues = z.infer<typeof resetSchema>;

export const ForgotPasswordPage = () => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');

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
    }
  });

  const onResetPassword = resetForm.handleSubmit(async (values) => {
    try {
      await authApi.resetPassword(email || values.email || '', values.token, values.newPassword);
      toast.success('Password reset successful. You can login now.');
      setStep('request');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Something went wrong'));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{step === 'request' ? 'Forgot password' : 'Reset password'}</CardTitle>
        <CardDescription>
          {step === 'request'
            ? 'Enter your email to receive a reset token.'
            : `Enter the token sent to ${email} and your new password.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'request' ? (
          <form className="space-y-4" onSubmit={onRequestToken}>
            <div className="space-y-3">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" className="pl-9" placeholder="name@example.com" {...requestForm.register('email')} />
              </div>
              {requestForm.formState.errors.email && (
                <p className="text-sm text-destructive">{requestForm.formState.errors.email.message}</p>
              )}
            </div>
            <Button className="w-full" type="submit">Send Reset Token</Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onResetPassword}>
            <div className="space-y-3">
              <Label htmlFor="token">Reset Token</Label>
              <Input id="token" placeholder="Paste token from email" {...resetForm.register('token')} />
              {resetForm.formState.errors.token && (
                <p className="text-sm text-destructive">{resetForm.formState.errors.token.message}</p>
              )}
            </div>
            <div className="space-y-3">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="newPassword" className="pl-9" type="password" placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} {...resetForm.register('newPassword')} />
              </div>
              {resetForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">{resetForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <Button className="w-full" type="submit">Reset Password</Button>
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
