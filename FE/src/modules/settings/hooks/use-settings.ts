import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useCurrentUser, useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { profileApi } from '@/modules/profile/api/profile.api';
import { type AppFont, DEFAULT_APP_FONT, TYPING_FONT_SIZE } from '@/shared/lib/app-font';

/** The settings of the Settings page the signed-in learner has chosen (SCRUM-158): the defaults while the user loads or on an old account. */
export const useSettings = (): { typingFontSizeRem: number; fontFamily: AppFont } => {
  const { data: user } = useCurrentUser();
  return {
    typingFontSizeRem: user?.settings?.typingFontSizeRem ?? TYPING_FONT_SIZE.default,
    fontFamily: user?.settings?.fontFamily ?? DEFAULT_APP_FONT,
  };
};

/** Saves one setting with `PATCH /api/profile/settings` and keeps the user it returns. A failure shows the backend message (no `onError`). */
const useSaveSetting = <T,>(toInput: (value: T) => Parameters<typeof profileApi.updateSettings>[0]) => {
  const queryClient = useQueryClient();
  const setCurrentUser = useSetCurrentUser();
  return useMutation({
    mutationFn: (value: T) => profileApi.updateSettings(toInput(value)),
    onSuccess: (user: CurrentUser) => {
      // An answer that comes after the learner signed out is dropped, as in `useSaveTimezone`.
      if (queryClient.getQueryData<CurrentUser>(currentUserKey)?._id !== user._id) return;
      setCurrentUser(user);
    },
  });
};

/** The size of the passage text on the typing page, in rem. */
export const useSaveTypingFontSize = () => useSaveSetting((typingFontSizeRem: number) => ({ typingFontSizeRem }));

/** The font of the whole interface. */
export const useSaveFontFamily = () => useSaveSetting((fontFamily: AppFont) => ({ fontFamily }));
