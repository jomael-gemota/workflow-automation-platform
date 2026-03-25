import { Queue } from 'bullmq';
import { getRedisConnection } from './redisConnection';

export interface WorkflowJobData {
    executionId: string;
    workflowId: string;
    input: Record<string, unknown>;
    triggeredBy: 'api' | 'webhook' | 'replay' | 'manual';
}

export const WORKFLOW_QUEUE_NAME = 'workflow-jobs';

let queue: Queue<WorkflowJobData> | null = null;

export function getWorkflowQueue(): Queue<WorkflowJobData> {
    if (!queue) {
        queue = new Queue<WorkflowJobData>(WORKFLOW_QUEUE_NAME, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 200,
            },
        });
    }
    return queue;
}
