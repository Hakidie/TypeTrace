import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { i18n } from '@/shared/i18n/i18n';
import { aiSettingsApi } from '../api/ai-settings.api';

export const aiSettingsKey = ['admin', 'ai-settings'] as const;

/** Admin: the AI limit in use. */
export const useAiSettings = () => useQuery({ queryKey: aiSettingsKey, queryFn: aiSettingsApi.get });

/** Admin: saves the limit; the answer is the saved settings, so no new request. */
export const useUpdateAiSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: aiSettingsApi.update,
    onSuccess: (settings) => {
      toast.success(i18n.t('settings:aiSettings.saved'));
      queryClient.setQueryData(aiSettingsKey, settings);
    },
  });
};
