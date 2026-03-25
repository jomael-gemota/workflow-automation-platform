import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { ExpressionResolver } from '../engine/ExpressionResolver';

interface OutputNodeConfig {
    value: string;
}

function isOutputNodeConfig(config: unknown): config is OutputNodeConfig {
    if (typeof config !== 'object' || config === null) return false;
    const c = config as Record<string, unknown>;
    return typeof c.value === 'string';
}

export class OutputNode implements NodeExecutor {
    private resolver = new ExpressionResolver();

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        if (!isOutputNodeConfig(node.config)) {
            throw new Error(`Node "${node.id}" has an invalid or incomplete output config. Expected: { value: string }`);
        }

        return this.resolver.resolve(node.config.value, context);
    }
}
