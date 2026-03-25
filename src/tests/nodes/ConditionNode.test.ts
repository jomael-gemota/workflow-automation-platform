import { describe, it, expect } from 'vitest';
import { ConditionNode } from '../../nodes/ConditionNode';
import { WorkflowNode, ExecutionContext } from '../../types/workflow.types';

function makeContext(variables: Record<string, unknown> = {}): ExecutionContext {
    return { workflowId: 'wf', executionId: 'exec', variables, startedAt: new Date() };
}

function makeNode(config: Record<string, unknown>): WorkflowNode {
    return { id: 'n1', type: 'condition', name: 'Condition', config, next: [] };
}

describe('ConditionNode', () => {
    const node = new ConditionNode();

    it('routes to trueNext when condition is true', async () => {
        const ctx = makeContext({ 'prev': { found: true } });
        const result = await node.execute(
            makeNode({
                condition: { type: 'leaf', left: 'nodes.prev.found', operator: 'eq', right: true },
                trueNext: 'node-true',
                falseNext: 'node-false',
            }),
            ctx
        );
        expect(result.branch).toBe('true');
        expect(result.nextNodeId).toBe('node-true');
        expect(result.result).toBe(true);
    });

    it('routes to falseNext when condition is false', async () => {
        const ctx = makeContext({ 'prev': { found: false } });
        const result = await node.execute(
            makeNode({
                condition: { type: 'leaf', left: 'nodes.prev.found', operator: 'eq', right: true },
                trueNext: 'node-true',
                falseNext: 'node-false',
            }),
            ctx
        );
        expect(result.branch).toBe('false');
        expect(result.nextNodeId).toBe('node-false');
        expect(result.result).toBe(false);
    });

    it('throws on invalid config', async () => {
        const ctx = makeContext({});
        await expect(node.execute(makeNode({}), ctx))
            .rejects.toThrow('invalid or incomplete condition config');
    });
});
