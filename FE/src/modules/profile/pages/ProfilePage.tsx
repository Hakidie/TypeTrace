import { useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileHeatmap } from '../components/ProfileHeatmap';
import { ProfileSessions } from '../components/ProfileSessions';
import { TodayProgress } from '../components/TodayProgress';
import { useStreak, useTypingActivity } from '../hooks/use-profile';

/**
 * The learner's own profile (SCRUM-157, SCRUM-31): who they are and how they type (`ProfileHeader`: the avatar, the name
 * and the bio changed in place, the numbers with the current and longest streak), then today's counted sessions and daily
 * mission (`TodayProgress`) over the heatmap of this year (`ProfileHeatmap`), all without a title or a frame, and the list
 * of the learner's finished sessions (`ProfileSessions`) at the bottom. The login code switch is in the Security panel of
 * the Settings page.
 */
export const ProfilePage = () => {
  const { data: user } = useCurrentUser();
  const activity = useTypingActivity();
  const streak = useStreak();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-12">
      {/* No title and no frame. */}
      <Panel bare>
        {user ? (
          <ProfileHeader
            user={user}
            activity={activity}
            streak={streak}
            onAvatarChange={() => queryClient.invalidateQueries({ queryKey: currentUserKey })}
          />
        ) : (
          <LoadingState rows={1} />
        )}
      </Panel>

      {/* Today and the heatmap under it, also without title or frame. */}
      <Panel bare>
        {user ? (
          <div className="space-y-3">
            <TodayProgress streak={streak} />
            <ProfileHeatmap activity={activity} since={user.createdAt} />
          </div>
        ) : (
          <LoadingState rows={1} />
        )}
      </Panel>

      {/* The list of the learner's finished sessions; a card opens its result page. */}
      <Panel bare>
        <ProfileSessions />
      </Panel>
    </div>
  );
};
