import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminPlanApi } from '../api/admin-plan.api';
import type { SubscriptionListParams } from '../types/plan.types';
import { planKeys } from './use-plan';

export const adminPlanKeys = {
  all: ['admin', 'plans'] as const,
  subscriptions: (params: SubscriptionListParams) => ['admin', 'subscriptions', params] as const,
};

/** The Free and Premium plans as they are saved. */
export const useAdminPlans = () => useQuery({ queryKey: adminPlanKeys.all, queryFn: adminPlanApi.get });

/** One page of the plan changes of all users; the previous page stays on screen while the next one loads. */
export const useSubscriptions = (params: SubscriptionListParams) =>
  useQuery({
    queryKey: adminPlanKeys.subscriptions(params),
    queryFn: () => adminPlanApi.listSubscriptions(params),
    placeholderData: keepPreviousData,
  });

/** Asks how many users and passages the plans would newly lock. No `onError`: the shared query client toasts the backend message. */
export const usePreviewPlans = () => useMutation({ mutationFn: adminPlanApi.preview });

export const useSavePlans = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminPlanApi.save,
    onSuccess: (saved) => {
      toast.success('Plans saved.');
      queryClient.setQueryData(adminPlanKeys.all, saved);
      // A learner's own plan (limit, permissions) reads the new numbers.
      return queryClient.invalidateQueries({ queryKey: planKeys.all });
    },
  });
};
