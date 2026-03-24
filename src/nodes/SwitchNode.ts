import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { ConditionEvaluator } from '../engine/ConditionEvaluator';
import { isSwitchNodeConfig } from '../utils/guards';

export interface SwitchNodeOutput {
    matchedCase: number | 'default';
    matchedLabel?: string;
    nextNodeId: string;
}

export class SwitchNode implements NodeExecutor {
    private evaluator = new ConditionEvaluator();

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<SwitchNodeOutput> {
        if (!isSwitchNodeConfig(node.config)) {
            throw new Error(`Node "${node.id}" has an invalid or incomplete switch config`);
        }

        const config = node.config;

        for (let i = 0; i < config.cases.length; i++) {
            const switchCase = config.cases[i];
            const matched = this.evaluator.evaluate(switchCase.condition, context);

            if (matched) {
                return {
                    matchedCase: i,
                    matchedLabel: switchCase.label,
                    nextNodeId: switchCase.next,
                };
            }
        }

        return {
            matchedCase: 'default',
            nextNodeId: config.defaultNext,
        };
    }
}