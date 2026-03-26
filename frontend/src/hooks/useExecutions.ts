import { useQuery } from '@tanstack/react-query';
import * as api from '../api/client';
import type { PaginatedResponse, ExecutionSummary } from '../types/workflow';

export function useExecutionList(workflowId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['executions', workflowId],
    queryFn: () => api.listExecutions(workflowId!, 20),
    select: (data) => data.data,
    enabled: !!workflowId && enabled,
    staleTime: 0,
    refetchInterval: (query) => {
      // query.state.data is the raw PaginatedResponse (pre-select); .data is the ExecutionSummary[]
      const raw = query.state.data as PaginatedResponse<ExecutionSummary> | undefined;
      const data = raw?.data ?? [];
      const hasActive = data.some(
        (e) => e.status === 'pending' || e.status === 'running'
      );
      return hasActive ? 2000 : false;
    },
  });
}

export function useExecution(id: string | null) {
  return useQuery({
    queryKey: ['executions', 'detail', id],
    queryFn: () => api.getExecution(id!),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      // Poll fast while active so canvas updates feel real-time
      return s === 'pending' || s === 'running' ? 500 : false;
    },
  });
}
