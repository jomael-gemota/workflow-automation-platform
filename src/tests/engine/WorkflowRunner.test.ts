import { describe, it, expect, vi } from 'vitest';
import { WorkflowRunner } from '../../engine/WorkflowRunner';
import { NodeExecutorRegistry } from '../../engine/NodeExecutorRegistry';
import { WorkflowDefinition, WorkflowNode, ExecutionContext } from '../../types/workflow.types';

function makeRegistry(handlers: Record<string, (node: WorkflowNode, ctx: ExecutionContext) => Promise<unknown>>) {
    const registry = new NodeExecutorRegistry();
    for (const [type, fn] of Object.entries(handlers)) {
        registry.register(type as any, { execute: fn });
    }
    return registry;
}

function makeWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
    return {
        id: 'wf-1',
        name: 'Test',
        version: 1,
        entryNodeId: 'n1',
        nodes: [
            { id: 'n1', type: 'http', name: 'Node 1', config: {}, next: ['n2'] },
            { id: 'n2', type: 'http', name: 'Node 2', config: {}, next: [] },
        ],
        ...overrides,
    };
}

describe('WorkflowRunner', () => {
    it('executes nodes in order and returns results', async () => {
        const execute = vi.fn().mockResolvedValue({ ok: true });
        const runner = new WorkflowRunner(makeRegistry({ http: execute }));
        const workflow = makeWorkflow();

        const { results } = await runner.run(workflow, {});

        expect(results).toHaveLength(2);
        expect(results[0].nodeId).toBe('n1');
        expect(results[0].status).toBe('success');
        expect(results[1].nodeId).toBe('n2');
        expect(results[1].status).toBe('success');
    });

    it('records failure and stops downstream on node error', async () => {
        const execute = vi.fn()
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValue({ ok: true });
        const runner = new WorkflowRunner(makeRegistry({ http: execute }));
        const workflow = makeWorkflow();

        const { results } = await runner.run(workflow, {});

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('failure');
        expect(results[0].error).toBe('Network error');
    });

    it('prevents infinite loops via visited set', async () => {
        const execute = vi.fn().mockResolvedValue({});
        const runner = new WorkflowRunner(makeRegistry({ http: execute }));
        const workflow = makeWorkflow({
            nodes: [
                { id: 'n1', type: 'http', name: 'Node 1', config: {}, next: ['n2'] },
                { id: 'n2', type: 'http', name: 'Node 2', config: {}, next: ['n1'] },
            ],
        });

        const { results } = await runner.run(workflow, {});
        expect(results).toHaveLength(2);
        expect(execute).toHaveBeenCalledTimes(2);
    });

    it('throws when entryNodeId does not exist', async () => {
        const runner = new WorkflowRunner(makeRegistry({ http: vi.fn() }));
        const workflow = makeWorkflow({ entryNodeId: 'nonexistent' });

        await expect(runner.run(workflow, {})).rejects.toThrow('Node "nonexistent" not found');
    });

    it('stores node output in context variables', async () => {
        let capturedContext: ExecutionContext | null = null;
        const registry = makeRegistry({
            http: async (node, ctx) => {
                if (node.id === 'n2') capturedContext = ctx;
                return { value: 42 };
            }
        });
        const runner = new WorkflowRunner(registry);
        await runner.run(makeWorkflow(), {});

        expect(capturedContext!.variables['n1']).toEqual({ value: 42 });
    });

    describe('retry logic', () => {
        it('retries on failure and succeeds', async () => {
            const execute = vi.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValue({ ok: true });
            const runner = new WorkflowRunner(makeRegistry({ http: execute }));
            const workflow = makeWorkflow({
                nodes: [{ id: 'n1', type: 'http', name: 'Node 1', config: {}, next: [], retries: 1 }],
            });

            const { results } = await runner.run(workflow, {});
            expect(results[0].status).toBe('success');
            expect(execute).toHaveBeenCalledTimes(2);
        });

        it('fails after exhausting all retries', async () => {
            const execute = vi.fn().mockRejectedValue(new Error('persistent fail'));
            const runner = new WorkflowRunner(makeRegistry({ http: execute }));
            const workflow = makeWorkflow({
                nodes: [{ id: 'n1', type: 'http', name: 'Node 1', config: {}, next: [], retries: 2 }],
            });

            const { results } = await runner.run(workflow, {});
            expect(results[0].status).toBe('failure');
            expect(execute).toHaveBeenCalledTimes(3);
        });
    });

    describe('timeout logic', () => {
        it('fails with timeout error when node exceeds timeoutMs', async () => {
            const execute = vi.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(resolve, 500))
            );
            const runner = new WorkflowRunner(makeRegistry({ http: execute }));
            const workflow = makeWorkflow({
                nodes: [{ id: 'n1', type: 'http', name: 'Node 1', config: {}, next: [], timeoutMs: 100 }],
            });

            const { results } = await runner.run(workflow, {});
            expect(results[0].status).toBe('failure');
            expect(results[0].error).toContain('timed out after 100ms');
        });
    });
});
