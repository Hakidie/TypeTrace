import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { FormField } from '@/shared/components/form-field';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { useUpdateUser } from '../hooks/use-admin';

// Mirrors `adminUpdateUserSchema` in BE/src/validators/admin-user.validator.ts.
const schema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(100, 'Max 100 characters'),
  // A disabled select (own account) submits no value, so the role is then left unchanged.
  role: z.enum(['user', 'admin']).optional(),
  isEmailVerified: z.boolean(),
  loginOtpEnabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface UserEditDialogProps {
  user: CurrentUser;
  /** The signed-in admin: their own role cannot be changed here. */
  isSelf: boolean;
  onClose: () => void;
}

const selectClass =
  'h-10 w-full border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

/** Details of one user plus the fields an admin may change. Mount with `key={user._id}`. */
export const UserEditDialog = ({ user, isSelf, onClose }: UserEditDialogProps) => {
  const updateUser = useUpdateUser();
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user.displayName ?? '',
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      loginOtpEnabled: user.loginOtpEnabled,
    },
  });

  const onSubmit = handleSubmit((input) => updateUser.mutate({ id: user._id, input }, { onSuccess: onClose }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            {user.email} · joined {new Date(user.createdAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField id="user-name" label="Display name" error={errors.displayName?.message}>
            <Input id="user-name" {...register('displayName')} />
          </FormField>

          <FormField id="user-role" label="Role" hint={isSelf ? 'You cannot change your own role' : undefined}>
            <select id="user-role" className={selectClass} disabled={isSelf} {...register('role')}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>

          <Controller
            control={control}
            name="isEmailVerified"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="user-verified">Email verified</Label>
                <Switch id="user-verified" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />

          <Controller
            control={control}
            name="loginOtpEnabled"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="user-otp">Email code at login</Label>
                <Switch id="user-otp" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
