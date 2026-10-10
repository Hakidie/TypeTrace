import { useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { AvatarUpload } from '@/modules/profile/components/AvatarUpload';
import { ProfileEditForm } from '@/modules/profile/components/ProfileEditForm';
import { SecuritySettings } from '@/modules/profile/components/SecuritySettings';
import { PageHeader } from '@/shared/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export const ProfilePage = () => {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your personal information." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — avatar + email */}
        <Card className="flex flex-col items-center gap-4 p-6 lg:col-span-1">
          <AvatarUpload
            currentAvatarUrl={user?.avatarUrl}
            userInitials={initials}
            onUploadSuccess={() => queryClient.invalidateQueries({ queryKey: currentUserKey })}
          />
          <div className="text-center">
            {user?.displayName && (
              <p className="font-semibold">{user.displayName}</p>
            )}
            <p className="text-base text-muted-foreground">{user?.email ?? '—'}</p>
          </div>
        </Card>

        {/* Right column — edit form + security */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {user ? (
                <ProfileEditForm
                  defaultValues={{
                    displayName: user.displayName ?? '',
                    bio: user.bio ?? '',
                    phone: user.phone ?? '',
                  }}
                />
              ) : (
                <p className="text-base text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security</CardTitle>
            </CardHeader>
            <CardContent>
              {user ? (
                <SecuritySettings user={user} />
              ) : (
                <p className="text-base text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
