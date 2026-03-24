import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { ConditionEvaluator } from '../engine/ConditionEvaluator';
import { isConditionNodeConfig } from '../utils/guards';

export interface ConditionNodeOutput {
    result: boolean;
    branch: 'true' | 'false';
    nextNodeId: string;
}

export class ConditionNode implements NodeExecutor {
    private evaluator = new ConditionEvaluator();

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<ConditionNodeOutput> {
        if (!isConditionNodeConfig(node.config)) {
            throw new Error(`Node "${node.id}" has an invalid or incomplete condition config`);
        }

        const config = node.config;

        const result = this.evaluator.evaluate(config.condition, context);
        const nextNodeId = result ? config.trueNext : config.falseNext;

        return {
            result,
            branch: result ? 'true' : 'false',
            nextNodeId,
        };
    }
}