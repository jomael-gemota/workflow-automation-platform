import { JSONPath } from "jsonpath-plus";
import { ExecutionContext } from '../types/workflow.types';

export class ExpressionResolver {
    resolve(expression: string, context: ExecutionContext): unknown {
        const trimmed = expression.trim();

        if (trimmed.startsWith('$')) {
            return this.resolveJsonPath(trimmed, context);
        }

        if (trimmed.startsWith('nodes.')) {
            return this.resolveDotNotation(trimmed, context);
        }

        return trimmed;
    }

    private resolveDotNotation(expression: string, context: ExecutionContext): unknown {
        const parts = expression.split('.');
        if (parts[0] !== 'nodes' || parts.length < 3) {
            throw new Error(`Invalid dot notation expression: "${expression}". Expected format: nodes.<nodeId>.output.<field>`);
        }

        const nodeId = parts[1];
        const nodeOutput = context.variables[nodeId];

        if (nodeOutput === undefined) {
            throw new Error(`Node "${nodeId}" has no output in context. Make sure it runs before this condition.`);
        }

        const remainingPath = parts.slice(2);
        return this.walkPath(nodeOutput, remainingPath, expression);
    }

    private resolveJsonPath(expression: string, context: ExecutionContext): unknown {
        const data = { nodes: context.variables };

        try {
            const results = JSONPath({ path: expression, json: data as object });
            if (!Array.isArray(results) || results.length === 0) return undefined;
            return results.length == 1 ? results[0] : results;
        } catch {
            throw new Error(`Invalid JSONPath expression: "${expression}"`);
        }
    }

    private walkPath(obj: unknown, path: string[], fullExpression: string): unknown {
        let current = obj;

        for (const key of path) {
            if (current == null || current == undefined) return undefined;
            if (typeof current !== 'object') {
                throw new Error(`Cannot access "${key}" on a non-object value in expression: "${fullExpression}"`);
            }
            current = (current as Record<string, unknown>)[key];
        }

        return current;
    }

    resolveTemplate(template: string, context: ExecutionContext): string {
        return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr) => {
            const value = this.resolve(expr.trim(), context);
            return value !== undefined && value !== null ? String(value) : `[missing: ${expr}]`;
        });
    }
}