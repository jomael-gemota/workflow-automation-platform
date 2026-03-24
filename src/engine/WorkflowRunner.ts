import { WorkflowDefinition, ExecutionContext, NodeResult } from '../types/workflow.types';
import { NodeExecutorRegistry } from './NodeExecutorRegistry';
import { WorkflowExecutionResult } from '../types/workflow.types';
import { ConditionNodeOutput } from '../nodes/ConditionNode';
import { SwitchNodeOutput } from '../nodes/SwitchNode';

export class WorkflowRunner {
    constructor(private registry: NodeExecutorRegistry) {}

    async run(workflow: WorkflowDefinition, input: unknown): Promise<WorkflowExecutionResult> {
        const context: ExecutionContext = {
            workflowId: workflow.id,
            executionId: crypto.randomUUID(),
            variables: { input },
            startedAt: new Date(),
        };

        const results: NodeResult[] = [];
        const visited = new Set<string>();

        await this.executeNode(workflow, workflow.entryNodeId, context, results, visited);
        return { executionId: context.executionId, results };
    }

    private async executeNode(
        workflow: WorkflowDefinition,
        nodeId: string,
        context: ExecutionContext,
        results: NodeResult[],
        visited: Set<string>
    ): Promise<void> {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) throw new Error(`Node "${nodeId}" not found in workflow`);

        const executor = this.registry.get(node.type);
        const start = Date.now();

        try {
            const output = await executor.execute(node, context);
            context.variables[nodeId] = output;

            results.push({
                nodeId,
                status: 'success',
                output,
                durationMs: Date.now() - start,
            });

            const nextNodeIds = this.resolveNextNodes(node.type, output, node.next);

            await Promise.all(
                nextNodeIds.map(nextId =>
                    this.executeNode(workflow, nextId, context, results, visited)
                )
            );

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            results.push({
                nodeId,
                status: 'failure',
                output: null,
                error: message,
                durationMs: Date.now() - start,
            });
        }
    }

    private resolveNextNodes(
        nodeType: string,
        output: unknown,
        staticNext: string[]
    ): string[] {
        if (nodeType === 'condition') {
            const condOutput = output as ConditionNodeOutput;
            return [condOutput.nextNodeId];
        }

        if (nodeType === 'switch') {
            const switchOutput = output as SwitchNodeOutput;
            return [switchOutput.nextNodeId];
        }

        return staticNext;
    }
}