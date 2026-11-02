import { useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { LoadingState } from '@/shared/components/loading-state';
import { ActivityHeatmapLegend } from '@/shared/components/activity-heatmap';
import { Panel } from '@/shared/components/panel';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileHeatmap } from '../components/ProfileHeatmap';
import { ProfileMonthlyChart } from '../components/ProfileMonthlyChart';
import { ProfileSessions } from '../components/ProfileSessions';
import { useStreak, useTypingActivity } from '../hooks/use-profile';

/**
 * The learner's own profile (SCRUM-157, SCRUM-31, SCRUM-112): who they are and how they type (`ProfileHeader`: the avatar,
 * the name and the bio changed in place, the numbers with the current and longest streak, and under them the
 * chart of WPM and accuracy, `ProfileMonthlyChart`, SCRUM-240, of the last 7 days; the Progress page has the same chart with a choice of year, month and week, and today's daily tasks, `ProfileDailyTasks`), then, titled Daily Progress, the heatmap of this year (`ProfileHeatmap`), and the list of the learner's finished sessions (`ProfileSessions`,
 * titled My Sessions) at the bottom; no panel has a frame. The login code switch is in the Security panel of the Settings page.
 */
export const ProfilePage = () => {
  const { data: user } = useCurrentUser();
  const activity = useTypingActivity();
  const streak = useStreak();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-12">
      {/* No title and no frame; the gap to Daily tasks is 3rem, like the others (`space-y-12`). */}
      {/* PANEL Profile header */}
      <Panel bare>
        {user ? (
          <ProfileHeader
            user={user}
            activity={activity}
            streak={streak}
            chart={<ProfileMonthlyChart range="week" />}
            onAvatarChange={() => queryClient.invalidateQueries({ queryKey: currentUserKey })}
          />
        ) : (
          <LoadingState rows={1} />
        )}
      </Panel>

      {/* The heatmap, under the header: a title, no frame. */}
      {/* PANEL Daily Progress */}
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
