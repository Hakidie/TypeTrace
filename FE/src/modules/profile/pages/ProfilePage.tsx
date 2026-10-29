import { useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { LoadingState } from '@/shared/components/loading-state';
import { ActivityHeatmapLegend } from '@/shared/components/activity-heatmap';
import { Panel } from '@/shared/components/panel';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { ProfileDailyTasks } from '../components/ProfileDailyTasks';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileHeatmap } from '../components/ProfileHeatmap';
import { ProfileSessions } from '../components/ProfileSessions';
import { useStreak, useTypingActivity } from '../hooks/use-profile';

/**
 * The learner's own profile (SCRUM-157, SCRUM-31, SCRUM-112): who they are and how they type (`ProfileHeader`: the avatar,
 * the name and the bio changed in place, the numbers with the current and longest streak), then today's tasks with their progress
 * bars (`ProfileDailyTasks`, titled Daily tasks), then, titled Daily Progress, the heatmap of this year (`ProfileHeatmap`), and the list of the learner's finished sessions (`ProfileSessions`,
 * titled My Sessions) at the bottom; no panel has a frame. The login code switch is in the Security panel of the Settings page.
 */
export const ProfilePage = () => {
  const { data: user } = useCurrentUser();
  const activity = useTypingActivity();
  const streak = useStreak();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-12">
      {/* No title and no frame; 12 more (pb-12) under it, so the gap to Daily tasks is twice the others. */}
      <Panel bare className="pb-12">
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

      {/* Today's tasks, above the heatmap, with a title of their own (`ProfileDailyTasks` has its panel). */}
      <ProfileDailyTasks />

      {/* The heatmap, under the tasks: a title, no frame. */}
      <Panel title="Daily Progress" bare titleClassName={sectionTitleClass} actions={<ActivityHeatmapLegend />}>
        {user ? (
          <ProfileHeatmap activity={activity} since={user.createdAt} />
        ) : (
          <LoadingState rows={1} />
        )}
      </Panel>

      {/* The list of the learner's finished sessions; a card opens its result page. */}
      <ProfileSessions />
    </div>
  );
};
