import { useQuery } from '@tanstack/react-query';
import { planApi } from '../api/plan.api';

/** Cache keys. Invalidating `planKeys.all` refreshes the plan (after a payment, a grant or a deleted passage). */
export const planKeys = {
  all: ['plan'] as const,
  mine: () => [...planKeys.all, 'mine'] as const,
};

/** The signed-in learner's plan, permissions and passage limit. */
export const usePlan = () => useQuery({ queryKey: planKeys.mine(), queryFn: planApi.get });
