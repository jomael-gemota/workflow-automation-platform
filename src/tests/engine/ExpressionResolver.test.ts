import { describe, it, expect } from 'vitest';
import { ExpressionResolver } from '../../engine/ExpressionResolver';
import { ExecutionContext } from '../../types/workflow.types';

function makeContext(variables: Record<string, unknown> = {}): ExecutionContext {
    return { workflowId: 'wf', executionId: 'exec', variables, startedAt: new Date() };
}

describe('ExpressionResolver', () => {
    const resolver = new ExpressionResolver();

    describe('dot notation', () => {
        it('resolves nested field', () => {
            const ctx = makeContext({ 'node-1': { status: 200 } });
            expect(resolver.resolve('nodes.node-1.status', ctx)).toBe(200);
        });

        it('returns undefined for missing field', () => {
            const ctx = makeContext({ 'node-1': { status: 200 } });
            expect(resolver.resolve('nodes.node-1.missing', ctx)).toBeUndefined();
        });

        it('throws for unknown node', () => {
            const ctx = makeContext({});
            expect(() => resolver.resolve('nodes.unknown.output', ctx))
                .toThrow('Node "unknown" has no output in context');
        });

        it('throws for invalid dot notation format', () => {
            const ctx = makeContext({});
            expect(() => resolver.resolve('nodes.only', ctx))
                .toThrow('Invalid dot notation expression');
        });
    });

    describe('JSONPath', () => {
        it('resolves via JSONPath', () => {
            const ctx = makeContext({ 'node-1': { count: 42 } });
            expect(resolver.resolve('$.nodes.node-1.count', ctx)).toBe(42);
        });

        it('returns undefined for non-matching path', () => {
            const ctx = makeContext({ 'node-1': {} });
            expect(resolver.resolve('$.nodes.node-1.missing', ctx)).toBeUndefined();
        });
    });

    describe('literal', () => {
        it('returns literal string unchanged', () => {
            const ctx = makeContext({});
            expect(resolver.resolve('hello', ctx)).toBe('hello');
        });
    });

    describe('resolveTemplate', () => {
        it('replaces {{ }} placeholders', () => {
            const ctx = makeContext({ 'node-1': { name: 'world' } });
            const result = resolver.resolveTemplate('Hello {{ nodes.node-1.name }}!', ctx);
            expect(result).toBe('Hello world!');
        });

        it('throws when a dot-notation node reference is missing from context', () => {
            const ctx = makeContext({});
            expect(() => resolver.resolveTemplate('Value: {{ nodes.missing.field }}', ctx))
                .toThrow('Node "missing" has no output in context');
        });

        it('replaces multiple placeholders', () => {
            const ctx = makeContext({ 'n1': { a: 'foo' }, 'n2': { b: 'bar' } });
            const result = resolver.resolveTemplate('{{ nodes.n1.a }} and {{ nodes.n2.b }}', ctx);
            expect(result).toBe('foo and bar');
        });
    });
});
