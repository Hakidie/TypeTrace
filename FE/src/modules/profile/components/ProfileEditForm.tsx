import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { profileApi } from '@/modules/profile/api/profile.api';
import { FormField } from '@/shared/components/form-field';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';

// Accepts digits with optional leading + and common separators (spaces, dashes, parentheses).
const phoneRegex = /^\+?[\d\s().-]+$/;

// Empty optional fields come through as '' from the inputs; treat '' as "not provided"
// so the value is stripped before hitting the backend (which rejects empty strings).
const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Max 100 characters'),
  bio: optionalTrimmed.pipe(z.string().max(200, 'Max 200 characters').optional()),
  phone: optionalTrimmed.pipe(
    z
      .string()
      .min(7, 'Phone must be at least 7 characters')
      .max(20, 'Max 20 characters')
      .regex(phoneRegex, 'Enter a valid phone number')
      .optional(),
  ),
});

type FormValues = z.input<typeof schema>;
type SubmitValues = z.output<typeof schema>;

interface ProfileEditFormProps {
  defaultValues: FormValues;
}

export const ProfileEditForm = ({ defaultValues }: ProfileEditFormProps) => {
  const setCurrentUser = useSetCurrentUser();

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues, unknown, SubmitValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // No `onError`: the shared query client shows the backend message as a toast.
  const updateProfile = useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: (user) => {
      setCurrentUser(user);
      toast.success('Profile updated successfully.');
    },
  });

  const bioValue = useWatch({ control, name: 'bio' }) ?? '';

  return (
    <form className="space-y-5" onSubmit={handleSubmit((values) => updateProfile.mutate(values))}>
      {/* The two short fields side by side from `md` up, the bio under them. */}
      <div className="grid gap-5 md:grid-cols-2">
        <FormField id="displayName" label="Display name" error={errors.displayName?.message}>
          <Input id="displayName" placeholder="Your name" {...register('displayName')} />
        </FormField>

        <FormField id="phone" label="Phone" error={errors.phone?.message}>
          <Input id="phone" placeholder="+84 912 345 678" {...register('phone')} />
        </FormField>
      </div>

      <FormField id="bio" label="Bio" error={errors.bio?.message} hint={`${bioValue.length}/200`}>
        <Textarea
          id="bio"
          rows={3}
          placeholder="Tell us a little about yourself..."
          className="resize-none"
          {...register('bio')}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
};
