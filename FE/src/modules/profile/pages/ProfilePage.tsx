import { useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { ProfileEditForm } from '../components/ProfileEditForm';
import { ProfileSummary } from '../components/ProfileSummary';
import { SecuritySettings } from '../components/SecuritySettings';
import { useTypingActivity } from '../hooks/use-profile';

/**
 * The learner's own profile (SCRUM-157), in the TypeTrace look of the other pages: a "Profile" panel with who they are
 * and how they type (`ProfileSummary`), then "Edit profile" and, next to it from `lg` up, "Security".
 */
export const ProfilePage = () => {
  const { data: user } = useCurrentUser();
  const activity = useTypingActivity();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6">
      <Panel title="Profile" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        {user ? (
          <ProfileSummary
            user={user}
            activity={activity}
            onAvatarChange={() => queryClient.invalidateQueries({ queryKey: currentUserKey })}
          />
        ) : (
          <LoadingState rows={2} />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Edit profile" bare titleClassName={panelTitleClass} className={panelBodyClass}>
            {user ? (
              <ProfileEditForm
                defaultValues={{
                  displayName: user.displayName ?? '',
                  bio: user.bio ?? '',
                  phone: user.phone ?? '',
                }}
              />
            ) : (
              <LoadingState rows={3} />
            )}
          </Panel>
        </div>
        <Panel title="Security" bare titleClassName={panelTitleClass} className={panelBodyClass}>
          {user ? <SecuritySettings user={user} /> : <LoadingState rows={1} />}
        </Panel>
      </div>
    </div>
  );
};
