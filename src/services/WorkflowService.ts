import crypto from 'crypto';
import { WorkflowRunner } from '../engine/WorkflowRunner';
import { WorkflowRepository } from '../repositories/WorkflowRepository';
import { ExecutionRepository } from '../repositories/ExecutionRepository';
import { ExecutionSummary } from '../types/api.types';
import { getWorkflowQueue } from '../queue/WorkflowQueue';

export class WorkflowService {
    constructor(
        private runner: WorkflowRunner,
        private workflowRepo: WorkflowRepository,
        private executionRepo: ExecutionRepository
    ) {}

    async trigger(
        workflowId: string,
        input: Record<string, unknown>,
        triggeredBy: 'api' | 'webhook' | 'replay' | 'manual' = 'api'
    ): Promise<ExecutionSummary> {
        const workflow = await this.workflowRepo.findById(workflowId);
        if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

        const startedAt = new Date();
        const executionId = crypto.randomUUID();

        await this.executionRepo.createPending(
            executionId,
            workflowId,
            workflow.version,
            input,
            triggeredBy
        );

        const queue = getWorkflowQueue();
        await queue.add('run', { executionId, workflowId, input, triggeredBy });

        return {
            executionId,
            workflowId,
            status: 'pending' as const,
            startedAt,
            completedAt: startedAt,
            results: [],
        };
    }

    async replay(executionId: string): Promise<ExecutionSummary> {
        const original = await this.executionRepo.findInput(executionId);
        if (!original) throw new Error(`Execution ${executionId} not found`);

        const { input, workflowId } = original as { input: Record<string, unknown>; workflowId: string };

        return this.trigger(workflowId, input, 'replay');
    }
}