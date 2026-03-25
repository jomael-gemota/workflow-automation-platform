import { describe, it, expect } from 'vitest';
import { TransformNode } from '../../nodes/TransformNode';
import { WorkflowNode, ExecutionContext } from '../../types/workflow.types';

function makeContext(variables: Record<string, unknown> = {}): ExecutionContext {
    return { workflowId: 'wf', executionId: 'exec', variables, startedAt: new Date() };
}

function makeNode(config: Record<string, unknown>): WorkflowNode {
    return { id: 'n1', type: 'transform', name: 'Transform', config, next: [] };
}

describe('TransformNode', () => {
    const node = new TransformNode();

    it('maps expression values to output keys', async () => {
        const ctx = makeContext({ 'api': { user: { name: 'Alice', age: 30 } } });
        const result = await node.execute(
            makeNode({ mappings: { userName: 'nodes.api.user.name', userAge: 'nodes.api.user.age' } }),
            ctx
        );
        expect(result).toEqual({ userName: 'Alice', userAge: 30 });
    });

    it('maps literal string values', async () => {
        const ctx = makeContext({});
        const result = await node.execute(
            makeNode({ mappings: { label: 'static-value' } }),
            ctx
        );
        expect(result).toEqual({ label: 'static-value' });
    });

    it('returns empty object for empty mappings', async () => {
        const ctx = makeContext({});
        const result = await node.execute(makeNode({ mappings: {} }), ctx);
        expect(result).toEqual({});
    });

    it('throws on invalid config', async () => {
        const ctx = makeContext({});
        await expect(node.execute(makeNode({}), ctx))
            .rejects.toThrow('invalid or incomplete transform config');
    });
});
