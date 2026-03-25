import { describe, it, expect } from 'vitest';
import { SwitchNode } from '../../nodes/SwitchNode';
import { WorkflowNode, ExecutionContext } from '../../types/workflow.types';

function makeContext(variables: Record<string, unknown> = {}): ExecutionContext {
    return { workflowId: 'wf', executionId: 'exec', variables, startedAt: new Date() };
}

function makeNode(config: Record<string, unknown>): WorkflowNode {
    return { id: 'n1', type: 'switch', name: 'Switch', config, next: [] };
}

const switchConfig = {
    cases: [
        {
            label: 'English',
            condition: { type: 'leaf', left: 'nodes.prev.lang', operator: 'eq', right: 'en' },
            next: 'node-en',
        },
        {
            label: 'German',
            condition: { type: 'leaf', left: 'nodes.prev.lang', operator: 'eq', right: 'de' },
            next: 'node-de',
        },
    ],
    defaultNext: 'node-default',
};

describe('SwitchNode', () => {
    const node = new SwitchNode();

    it('routes to first matching case', async () => {
        const ctx = makeContext({ prev: { lang: 'en' } });
        const result = await node.execute(makeNode(switchConfig), ctx);
        expect(result.matchedCase).toBe(0);
        expect(result.matchedLabel).toBe('English');
        expect(result.nextNodeId).toBe('node-en');
    });

    it('routes to second matching case', async () => {
        const ctx = makeContext({ prev: { lang: 'de' } });
        const result = await node.execute(makeNode(switchConfig), ctx);
        expect(result.matchedCase).toBe(1);
        expect(result.matchedLabel).toBe('German');
        expect(result.nextNodeId).toBe('node-de');
    });

    it('routes to defaultNext when no case matches', async () => {
        const ctx = makeContext({ prev: { lang: 'fr' } });
        const result = await node.execute(makeNode(switchConfig), ctx);
        expect(result.matchedCase).toBe('default');
        expect(result.nextNodeId).toBe('node-default');
    });

    it('throws on invalid config', async () => {
        const ctx = makeContext({});
        await expect(node.execute(makeNode({}), ctx))
            .rejects.toThrow('invalid or incomplete switch config');
    });
});
