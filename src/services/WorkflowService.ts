import { WorkflowRunner } from '../engine/WorkflowRunner';
import { WorkflowRepository } from '../repositories/WorkflowRepository';
import { ExecutionRepository } from '../repositories/ExecutionRepository';
import { ExecutionSummary } from '../types/api.types';
import { NodeResult } from '../types/workflow.types';

export class WorkflowService {
    constructor(
        private runner: WorkflowRunner,
        private workflowRepo: WorkflowRepository,
        private executionRepo: ExecutionRepository
    ) {}

    async trigger(workflowId: string, input: Record<string, unknown>): Promise<ExecutionSummary> {
        const workflow = this.workflowRepo.findById(workflowId);
        if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

        const startedAt = new Date();
        const { executionId, results } = await this.runner.run(workflow, input);
        const completedAt = new Date();

        const status = this.deriveStatus(results);

        const summary: ExecutionSummary = {
            executionId,
            workflowId,
            status,
            startedAt,
            completedAt,
            results,
        };

        this.executionRepo.save(summary);
        return summary;
    }

    private deriveStatus(results: NodeResult[]): ExecutionSummary['status'] {
        const hasFailure = results.some(r => r.status === 'failure');
        const hasSuccess = results.some(r => r.status === 'success');

        if (hasFailure && hasSuccess) return 'partial';
        if (hasFailure) return 'failure';
        return 'success';
    }
}