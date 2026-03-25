import { describe, it, expect } from 'vitest';
import { ConditionEvaluator } from '../../engine/ConditionEvaluator';
import { ExecutionContext } from '../../types/workflow.types';

function makeContext(variables: Record<string, unknown> = {}): ExecutionContext {
    return {
        workflowId: 'wf-test',
        executionId: 'exec-test',
        variables,
        startedAt: new Date(),
    };
}

describe('ConditionEvaluator', () => {
    const evaluator = new ConditionEvaluator();

    describe('leaf operators', () => {
        it('eq — equal values', () => {
            const ctx = makeContext({ 'node-1': { status: 200 } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.status', operator: 'eq', right: 200 },
                ctx
            )).toBe(true);
        });

        it('eq — unequal values', () => {
            const ctx = makeContext({ 'node-1': { status: 404 } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.status', operator: 'eq', right: 200 },
                ctx
            )).toBe(false);
        });

        it('neq', () => {
            const ctx = makeContext({ 'node-1': { status: 404 } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.status', operator: 'neq', right: 200 },
                ctx
            )).toBe(true);
        });

        it('gt', () => {
            const ctx = makeContext({ 'node-1': { count: 10 } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.count', operator: 'gt', right: 5 },
                ctx
            )).toBe(true);
        });

        it('gte — equal', () => {
            const ctx = makeContext({ 'node-1': { count: 5 } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.count', operator: 'gte', right: 5 },
                ctx
            )).toBe(true);
        });

        it('lt', () => {
            const ctx = makeContext({ 'node-1': { count: 3 } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.count', operator: 'lt', right: 5 },
                ctx
            )).toBe(true);
        });

        it('lte — equal', () => {
            const ctx = makeContext({ 'node-1': { count: 5 } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.count', operator: 'lte', right: 5 },
                ctx
            )).toBe(true);
        });

        it('contains', () => {
            const ctx = makeContext({ 'node-1': { text: 'hello world' } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.text', operator: 'contains', right: 'world' },
                ctx
            )).toBe(true);
        });

        it('startsWith', () => {
            const ctx = makeContext({ 'node-1': { text: 'hello world' } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.text', operator: 'startsWith', right: 'hello' },
                ctx
            )).toBe(true);
        });

        it('endsWith', () => {
            const ctx = makeContext({ 'node-1': { text: 'hello world' } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.text', operator: 'endsWith', right: 'world' },
                ctx
            )).toBe(true);
        });

        it('isNull — null value', () => {
            const ctx = makeContext({ 'node-1': { val: null } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.val', operator: 'isNull', right: null },
                ctx
            )).toBe(true);
        });

        it('isNotNull — non-null value', () => {
            const ctx = makeContext({ 'node-1': { val: 'something' } });
            expect(evaluator.evaluate(
                { type: 'leaf', left: 'nodes.node-1.val', operator: 'isNotNull', right: null },
                ctx
            )).toBe(true);
        });
    });

    describe('group operators', () => {
        it('and — all true', () => {
            const ctx = makeContext({ 'node-1': { a: 1, b: 2 } });
            expect(evaluator.evaluate({
                type: 'group',
                operator: 'and',
                conditions: [
                    { type: 'leaf', left: 'nodes.node-1.a', operator: 'eq', right: 1 },
                    { type: 'leaf', left: 'nodes.node-1.b', operator: 'eq', right: 2 },
                ],
            }, ctx)).toBe(true);
        });

        it('and — one false', () => {
            const ctx = makeContext({ 'node-1': { a: 1, b: 99 } });
            expect(evaluator.evaluate({
                type: 'group',
                operator: 'and',
                conditions: [
                    { type: 'leaf', left: 'nodes.node-1.a', operator: 'eq', right: 1 },
                    { type: 'leaf', left: 'nodes.node-1.b', operator: 'eq', right: 2 },
                ],
            }, ctx)).toBe(false);
        });

        it('or — one true', () => {
            const ctx = makeContext({ 'node-1': { a: 1, b: 99 } });
            expect(evaluator.evaluate({
                type: 'group',
                operator: 'or',
                conditions: [
                    { type: 'leaf', left: 'nodes.node-1.a', operator: 'eq', right: 1 },
                    { type: 'leaf', left: 'nodes.node-1.b', operator: 'eq', right: 2 },
                ],
            }, ctx)).toBe(true);
        });

        it('not — negates true', () => {
            const ctx = makeContext({ 'node-1': { a: 1 } });
            expect(evaluator.evaluate({
                type: 'group',
                operator: 'not',
                conditions: [
                    { type: 'leaf', left: 'nodes.node-1.a', operator: 'eq', right: 1 },
                ],
            }, ctx)).toBe(false);
        });

        it('not — throws on multiple conditions', () => {
            const ctx = makeContext({ 'node-1': { a: 1 } });
            expect(() => evaluator.evaluate({
                type: 'group',
                operator: 'not',
                conditions: [
                    { type: 'leaf', left: 'nodes.node-1.a', operator: 'eq', right: 1 },
                    { type: 'leaf', left: 'nodes.node-1.a', operator: 'eq', right: 1 },
                ],
            }, ctx)).toThrow('"not" operator expects exactly 1 condition');
        });
    });
});
