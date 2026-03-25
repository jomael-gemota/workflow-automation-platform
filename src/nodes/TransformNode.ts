import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { ExpressionResolver } from '../engine/ExpressionResolver';

interface TransformNodeConfig {
    mappings: Record<string, string>;
}

function isTransformNodeConfig(config: unknown): config is TransformNodeConfig {
    if (typeof config !== 'object' || config === null) return false;
    const c = config as Record<string, unknown>;
    return typeof c.mappings === 'object' && c.mappings !== null && !Array.isArray(c.mappings);
}

export class TransformNode implements NodeExecutor {
    private resolver = new ExpressionResolver();

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, unknown>> {
        if (!isTransformNodeConfig(node.config)) {
            throw new Error(`Node "${node.id}" has an invalid or incomplete transform config. Expected: { mappings: Record<string, string> }`);
        }

        const { mappings } = node.config;
        const output: Record<string, unknown> = {};

        for (const [key, expression] of Object.entries(mappings)) {
            output[key] = this.resolver.resolve(expression, context);
        }

        return output;
    }
}
