import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/client';
import type { NodeTestResult } from '../types/workflow';

export function useNodeTestResults(workflowId: string | null | undefined) {
  return useQuery({
    queryKey: ['node-test-results', workflowId],
    queryFn: () => api.getNodeTestResults(workflowId!),
    enabled: !!workflowId && !workflowId.startsWith('__new__'),
    staleTime: 0,
  });
}

export function useTestNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workflowId,
      nodeId,
      context,
    }: {
      workflowId: string;
      nodeId: string;
      context?: Record<string, unknown>;
    }) => api.testNode(workflowId, nodeId, context),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['node-test-results', vars.workflowId] });
    },
  });
}

export type { NodeTestResult };
