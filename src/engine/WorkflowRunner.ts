import crypto from 'crypto';
import { WorkflowDefinition, WorkflowNode, ExecutionContext, NodeResult } from '../types/workflow.types';
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
            const output = await this.executeWithRetryAndTimeout(node, context, executor);
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

    private async executeWithRetryAndTimeout(
        node: WorkflowNode,
        context: ExecutionContext,
        executor: { execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> }
    ): Promise<unknown> {
        const maxAttempts = (node.retries ?? 0) + 1;
        const retryDelayMs = node.retryDelayMs ?? 0;
        const timeoutMs = node.timeoutMs;

        let lastError: Error = new Error('Unknown error');

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.executeWithTimeout(
                    executor.execute(node, context),
                    timeoutMs,
                    node.id
                );
            } catch (err: unknown) {
                lastError = err instanceof Error ? err : new Error(String(err));
                if (attempt < maxAttempts && retryDelayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                }
            }
        }

        throw lastError;
    }

    private executeWithTimeout(
        promise: Promise<unknown>,
        timeoutMs: number | undefined,
        nodeId: string
    ): Promise<unknown> {
        if (!timeoutMs) return promise;

        const timeout = new Promise<never>((_, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Node "${nodeId}" timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            promise.finally(() => clearTimeout(timer));
        });

        return Promise.race([promise, timeout]);
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