import { useEffect } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { browserTimeZone, sameTimeZone } from '@/shared/lib/local-date';
import { useSaveTimezone } from '../hooks/use-profile';

// The users whose zone was sent during this page load: it is sent at most once per user, even when it fails, so a
// failure never turns into a loop of requests. A reload tries again.
const sentFor = new Set<string>();

/**
 * Draws nothing. Once the signed-in user is known, sends the browser's time zone when it is not the one saved on the
 * account (`settings.timezone`), so the learner's days (streak, daily mission, heatmap) are their own calendar days.
 * Registered as a widget of the profile module, so it runs on every page of the main app.
 */
export const TimezoneSync = () => {
  const { data: user } = useCurrentUser();
  const { mutate: saveTimezone } = useSaveTimezone();

  useEffect(() => {
    const zone = browserTimeZone();
    if (!user || !zone || sameTimeZone(zone, user.settings?.timezone) || sentFor.has(user._id)) return;
    sentFor.add(user._id);
    saveTimezone(zone);
  }, [user, saveTimezone]);

  return null;
};
