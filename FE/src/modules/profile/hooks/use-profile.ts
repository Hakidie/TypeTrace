import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useCurrentUser, useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import { profileApi } from '../api/profile.api';
import type { ChartCompare, ChartRange, SessionListParams } from '../types/profile.types';

/** Cache keys. Invalidating `profileKeys.all` refreshes every profile query. */
export const profileKeys = {
  all: ['profile'] as const,
  activity: () => [...profileKeys.all, 'activity'] as const,
  sessions: (params: SessionListParams) => [...profileKeys.all, 'sessions', params] as const,
  streak: () => [...profileKeys.all, 'streak'] as const,
  dailyTasks: () => [...profileKeys.all, 'daily-tasks'] as const,
  errorProfile: () => [...profileKeys.all, 'error-profile'] as const,
  monthlyProgressAll: () => [...profileKeys.all, 'monthly-progress'] as const,
  monthlyProgress: (range: ChartRange, date?: string) => [...profileKeys.monthlyProgressAll(), range, date ?? ''] as const,
};

/**
 * The queries whose figures are the ones of the learner's typing language (SCRUM-219): the server answers them in the
 * language saved on the account, so they are emptied when it changes (`useSaveTypingLanguage`).
 */
const languageKeys = [profileKeys.activity(), profileKeys.errorProfile(), profileKeys.monthlyProgressAll()];

/**
 * The learner's typing activity: average speed and accuracy in their typing language (SCRUM-219), counted sessions per
 * day (both languages). Sessions are completed on the typing page, so it is asked again each time the profile page opens
 * (`staleTime: 0`).
 */
export const useTypingActivity = () =>
  useQuery({ queryKey: profileKeys.activity(), queryFn: profileApi.getActivity, staleTime: 0 });

/** One page of the learner's sessions; the previous page stays on screen while the next one loads. Asked again each time the page opens, like the activity. */
export const useSessions = (params: SessionListParams) =>
  useQuery({
    queryKey: profileKeys.sessions(params),
    queryFn: () => profileApi.getSessions(params),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

/** The learner's current and longest streak and today's daily mission; asked again each time the profile page opens, like the activity. */
export const useStreak = () => useQuery({ queryKey: profileKeys.streak(), queryFn: profileApi.getStreak, staleTime: 0 });

/** Claims today's streak reward, then shows the new coins of the signed-in user and asks for the streak again. */
export const useClaimStreakReward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.claimStreakReward,
    onSuccess: ({ totalCoins }) => {
      queryClient.setQueryData<CurrentUser>(currentUserKey, (user) => (user ? { ...user, coins: totalCoins } : user));
      void queryClient.invalidateQueries({ queryKey: profileKeys.streak() });
    },
  });
};

/**
 * The learner's tasks of today and how far they are (SCRUM-112); asked again each time the profile page opens, like the
 * streak. Not the admins' list of task templates: that one is `useDailyTasks` of the daily-tasks module.
 */
export const useDailyTasks = () => useQuery({ queryKey: profileKeys.dailyTasks(), queryFn: profileApi.getDailyTasks, staleTime: 0 });

/**
 * The learner's error profile (SCRUM-27): rate, level and trend of each error type of their typing language (SCRUM-219) in
 * their last counted sessions of it, worked out by the backend when asked; asked again each time the profile page opens,
 * like the streak, so it has the sessions just typed.
 */
export const useErrorProfile = () =>
  useQuery({ queryKey: profileKeys.errorProfile(), queryFn: profileApi.getErrorProfile, staleTime: 0 });

/** The learner's average WPM and errors by month, week or day, by `range`, and with `date` the year, month or week that holds that day (SCRUM-240), in their typing language (SCRUM-219); asked again each time the profile page opens, like the streak. The range on screen stays while the next one loads. */
export const useMonthlyProgress = (range: ChartRange, date?: string) =>
  useQuery({
    queryKey: profileKeys.monthlyProgress(range, date),
    queryFn: () => profileApi.getMonthlyProgress(range, date),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

/** The same, for several periods at once (the ones put on the chart to compare with), in the order given. */
export const useMonthlyProgressSet = (periods: ChartCompare[]) =>
  useQueries({
    queries: periods.map(({ range, date }) => ({
      queryKey: profileKeys.monthlyProgress(range, date),
      queryFn: () => profileApi.getMonthlyProgress(range, date),
      placeholderData: keepPreviousData,
      staleTime: 0,
    })),
  });

/**
 * Saves the learner's time zone (`PATCH /api/profile/settings`), keeps the user it returns and refreshes the profile
 * queries, whose days depend on the zone. A failure is silent (its own `onError`, so no error toast): the days stay in
 * the zone saved before. An answer that comes after the learner signed out (the request is sent on its own at page
 * load) is dropped, so it never shows their account to the next one.
 */
export const useSaveTimezone = () => {
  const queryClient = useQueryClient();
  const setCurrentUser = useSetCurrentUser();
  return useMutation({
    mutationFn: (timezone: string) => profileApi.updateSettings({ timezone }),
    onSuccess: async (user) => {
      if (queryClient.getQueryData<CurrentUser>(currentUserKey)?._id !== user._id) return;
      setCurrentUser(user);
      // Invalidating keeps the answer of a first fetch still on its way, asked in the old zone: cancel it first.
      await queryClient.cancelQueries({ queryKey: profileKeys.all });
      return queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
    onError: () => undefined,
  });
};

/** The language the signed-in learner types in Practice (SCRUM-219): Vietnamese on an account from before it; `undefined` while the user loads. */
export const useTypingLanguage = (): TypingLanguage | undefined => {
  const { data: user } = useCurrentUser();
  return user ? (user.settings?.typingLanguage ?? 'vi') : undefined;
};

/**
 * Saves the language the learner types in Practice (SCRUM-219, `PATCH /api/profile/settings`) and keeps the user it
 * returns: the next Practice session is typed in it. The figures of the other language are emptied (`resetQueries`, not
 * only marked old), so the profile never shows them again while it asks for the new ones. A failure shows the backend
 * message (no `onError`). An answer that comes after the learner signed out is dropped, as in `useSaveTimezone`.
 */
export const useSaveTypingLanguage = () => {
  const queryClient = useQueryClient();
  const setCurrentUser = useSetCurrentUser();
  return useMutation({
    mutationFn: (typingLanguage: TypingLanguage) => profileApi.updateSettings({ typingLanguage }),
    onSuccess: (user) => {
      if (queryClient.getQueryData<CurrentUser>(currentUserKey)?._id !== user._id) return;
      setCurrentUser(user);
      // A reset also drops an answer still on its way (asked in the old language). Not awaited: the page goes on at once.
      for (const queryKey of languageKeys) void queryClient.resetQueries({ queryKey });
    },
  });
};
