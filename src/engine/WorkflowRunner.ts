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

        // Resolve which nodes are entry points (support multiple parallel starts)
        const entryIds = workflow.entryNodeIds?.length
            ? workflow.entryNodeIds
            : [workflow.entryNodeId];

        // Pre-compute in-degree for fan-in (join) logic.
        // Only node.next edges count — condition/switch targets live in config, not next[],
        // so exclusive branches are naturally excluded from join counting.
        const pendingCounts = this.buildPendingCounts(workflow, entryIds);

        // Cycle guard — a node only executes once even if multiple paths reach it
        const visited = new Set<string>();

        await Promise.all(
            entryIds.map(id =>
                this.executeNode(workflow, id, context, results, pendingCounts, visited)
            )
        );

        return { executionId: context.executionId, results };
    }

    /**
     * Build a Map<nodeId, pendingUpstreamCount> for every node.
     * A join node (in-degree > 1) will block until all its upstream branches complete.
     * Entry nodes are pinned to 0 so they always start immediately.
     */
    private buildPendingCounts(
        workflow: WorkflowDefinition,
        entryIds: string[]
    ): Map<string, number> {
        const counts = new Map<string, number>();

        for (const node of workflow.nodes) {
            if (!counts.has(node.id)) counts.set(node.id, 0);
            // Count how many edges point TO each successor
            for (const nextId of node.next) {
                counts.set(nextId, (counts.get(nextId) ?? 0) + 1);
            }
        }

        // Entry nodes always start regardless of computed in-degree
        for (const id of entryIds) {
            counts.set(id, 0);
        }

        return counts;
    }

    private async executeNode(
        workflow: WorkflowDefinition,
        nodeId: string,
        context: ExecutionContext,
        results: NodeResult[],
        pendingCounts: Map<string, number>,
        visited: Set<string>
    ): Promise<void> {
        // Fan-in gate: decrement the pending count for this node.
        // A join node (in-degree N) only proceeds when all N upstream branches have arrived.
        const remaining = (pendingCounts.get(nodeId) ?? 0) - 1;
        pendingCounts.set(nodeId, remaining);
        if (remaining > 0) return; // Still waiting for other branches

        // Cycle guard
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
                    this.executeNode(workflow, nextId, context, results, pendingCounts, visited)
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