import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dailyTasksApi } from '../api/daily-tasks.api';
import type { DailyTaskInput, DailyTaskListParams } from '../types/daily-task.types';

/** Cache keys. Invalidating `dailyTaskKeys.all` refreshes every daily task query. */
export const dailyTaskKeys = {
  all: ['daily-tasks'] as const,
  list: (params: DailyTaskListParams) => [...dailyTaskKeys.all, 'list', params] as const,
  settings: () => [...dailyTaskKeys.all, 'settings'] as const,
};

/** Keeps the previous page on screen while the next one loads. */
export const useDailyTasks = (params: DailyTaskListParams) =>
  useQuery({
    queryKey: dailyTaskKeys.list(params),
    queryFn: () => dailyTasksApi.list(params),
    placeholderData: keepPreviousData,
  });

const ACTIVE_TASKS: DailyTaskListParams = { isActive: 'true', limit: 1 };

/** How many tasks are active: the `total` of a one-task page of them. */
export const useActiveDailyTaskCount = () =>
  useQuery({
    queryKey: dailyTaskKeys.list(ACTIVE_TASKS),
    queryFn: () => dailyTasksApi.list(ACTIVE_TASKS),
    select: (page) => page.total,
  });

export const useDailyTaskSettings = () =>
  useQuery({ queryKey: dailyTaskKeys.settings(), queryFn: dailyTasksApi.getSettings });

// Mutations: no `onError` — the shared query client toasts the backend message.

export const useCreateDailyTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dailyTasksApi.create,
    onSuccess: () => {
      toast.success('Daily task created.');
      return queryClient.invalidateQueries({ queryKey: dailyTaskKeys.all });
    },
  });
};

export const useUpdateDailyTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DailyTaskInput> }) => dailyTasksApi.update(id, input),
    onSuccess: () => {
      toast.success('Daily task updated.');
      return queryClient.invalidateQueries({ queryKey: dailyTaskKeys.all });
    },
  });
};

export const useDeleteDailyTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dailyTasksApi.remove,
    onSuccess: () => {
      toast.success('Daily task deleted.');
      return queryClient.invalidateQueries({ queryKey: dailyTaskKeys.all });
    },
  });
};

export const useUpdateDailyTaskSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dailyTasksApi.updateSettings,
    onSuccess: (settings) => {
      toast.success('Tasks per day saved.');
      // The answer is the saved settings: no need to ask again.
      queryClient.setQueryData(dailyTaskKeys.settings(), settings);
    },
  });
};
