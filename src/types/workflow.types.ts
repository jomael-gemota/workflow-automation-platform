export type NodeType = 'trigger' | 'llm' | 'http' | 'condition' | 'switch' | 'transform' | 'output';

export interface WorkflowNode {
    id: string;
    type: NodeType;
    name: string;
    config: Record<string, unknown>;
    next: string[];
    retries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    /** Canvas position saved by the visual builder */
    position?: { x: number; y: number };
}

export interface WorkflowDefinition {
    id: string;
    name: string;
    version: number;
    nodes: WorkflowNode[];
    entryNodeId: string;       // Primary / first entry node (kept for backward compat)
    entryNodeIds?: string[];   // All parallel entry nodes; overrides entryNodeId when present
    schedule?: string;
}

export interface ExecutionContext {
    workflowId: string;
    executionId: string;
    variables: Record<string, unknown>;
    startedAt: Date;
}

export interface NodeResult {
    nodeId: string;
    status: 'success' | 'failure' | 'skipped';
    output: unknown;
    error?: string;
    durationMs: number;
}

export interface WorkflowExecutionResult {
  executionId: string;
  results: NodeResult[];
}