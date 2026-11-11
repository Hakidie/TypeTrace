import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { LoadingState } from '@/shared/components/loading-state';
import { ActivityHeatmapLegend } from '@/shared/components/activity-heatmap';
import { Panel } from '@/shared/components/panel';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { ProfileDailyTasks } from '../components/ProfileDailyTasks';
import { ProfileErrorProfile } from '../components/ProfileErrorProfile';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileHeatmap } from '../components/ProfileHeatmap';
import { ProfileMonthlyChart } from '../components/ProfileMonthlyChart';
import { useStreak, useTypingActivity } from '../hooks/use-profile';

/**
 * The learner's own profile (SCRUM-157, SCRUM-31, SCRUM-112): who they are and how they type (`ProfileHeader`: the avatar,
 * the name and the bio changed in place, the numbers with the current and longest streak, and under them the
 * chart of WPM and accuracy, `ProfileMonthlyChart`, SCRUM-240, of the last 7 days; the Progress page has the same chart with a choice of year, month and week, and under it the error profile or the list of the learner's finished sessions, `ProfileSessions`, titled My Sessions), then, titled Daily Progress, the heatmap of this year (`ProfileHeatmap`), and at the bottom one place for today's
 * daily tasks (`ProfileDailyTasks`, first) and the error profile (`ProfileErrorProfile`), each with a button that shows the other; no panel has a frame. The login code switch is in the Security panel of the Settings page.
 */
export const ProfilePage = () => {
  const { data: user } = useCurrentUser();
  const activity = useTypingActivity();
  const streak = useStreak();
  const queryClient = useQueryClient();
  // The panel under the heatmap: today's daily tasks (first) or the error profile, switched by the button next to its title.
  const [bottomPanel, setBottomPanel] = useState<'tasks' | 'errors'>('tasks');

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

      {/* One place for two panels: the button next to the title of each shows the other (daily tasks first). */}
      {bottomPanel === 'tasks' ? (
        <ProfileDailyTasks onSwitch={() => setBottomPanel('errors')} />
      ) : (
        <ProfileErrorProfile onSwitch={() => setBottomPanel('tasks')} switchTo="Daily tasks" />
      )}
    </div>
  );
};
