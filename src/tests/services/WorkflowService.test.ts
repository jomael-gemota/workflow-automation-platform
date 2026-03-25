import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowService } from '../../services/WorkflowService';
import { WorkflowDefinition } from '../../types/workflow.types';

vi.mock('../../queue/WorkflowQueue', () => ({
    getWorkflowQueue: () => ({
        add: vi.fn().mockResolvedValue({}),
    }),
}));

function makeWorkflow(id = 'wf-1'): WorkflowDefinition {
    return {
        id,
        name: 'Test Workflow',
        version: 1,
        entryNodeId: 'n1',
        nodes: [{ id: 'n1', type: 'http', name: 'Node', config: {}, next: [] }],
    };
}

function makeRunner() {
    return { run: vi.fn().mockResolvedValue({ executionId: 'exec-123', results: [] }) } as any;
}

function makeWorkflowRepo(workflow: WorkflowDefinition | null = makeWorkflow()) {
    return { findById: vi.fn().mockResolvedValue(workflow) } as any;
}

function makeExecutionRepo() {
    return {
        createPending: vi.fn().mockResolvedValue(undefined),
        markRunning: vi.fn().mockResolvedValue(undefined),
        complete: vi.fn().mockResolvedValue(undefined),
        findInput: vi.fn(),
    } as any;
}

describe('WorkflowService', () => {
    describe('trigger', () => {
        it('returns pending execution summary immediately', async () => {
            const service = new WorkflowService(makeRunner(), makeWorkflowRepo(), makeExecutionRepo());

            const summary = await service.trigger('wf-1', { key: 'value' });

            expect(summary.status).toBe('pending');
            expect(summary.workflowId).toBe('wf-1');
            expect(summary.executionId).toBeTruthy();
        });

        it('creates a pending execution record', async () => {
            const executionRepo = makeExecutionRepo();
            const service = new WorkflowService(makeRunner(), makeWorkflowRepo(), executionRepo);

            await service.trigger('wf-1', { key: 'value' }, 'api');

            expect(executionRepo.createPending).toHaveBeenCalledOnce();
            const args = executionRepo.createPending.mock.calls[0];
            expect(args[1]).toBe('wf-1');
            expect(args[4]).toBe('api');
        });

        it('throws when workflow is not found', async () => {
            const service = new WorkflowService(makeRunner(), makeWorkflowRepo(null), makeExecutionRepo());

            await expect(service.trigger('nonexistent', {}))
                .rejects.toThrow('Workflow nonexistent not found');
        });
    });

    describe('replay', () => {
        it('triggers with original input', async () => {
            const executionRepo = makeExecutionRepo();
            executionRepo.findInput = vi.fn().mockResolvedValue({
                input: { original: true },
                workflowId: 'wf-1',
            });
            const service = new WorkflowService(makeRunner(), makeWorkflowRepo(), executionRepo);

            const summary = await service.replay('exec-original');

            expect(summary.workflowId).toBe('wf-1');
            expect(summary.status).toBe('pending');
        });

        it('throws when original execution is not found', async () => {
            const executionRepo = makeExecutionRepo();
            executionRepo.findInput = vi.fn().mockResolvedValue(null);
            const service = new WorkflowService(makeRunner(), makeWorkflowRepo(), executionRepo);

            await expect(service.replay('nonexistent'))
                .rejects.toThrow('Execution nonexistent not found');
        });
    });
});
