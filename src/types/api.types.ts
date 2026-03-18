export interface ApiKey {
    id: string;
    key: string;
    name: string;
    createdAt: Date;
}

export interface TriggerWorkflowBody {
    workflowId: string;
    input?: Record<string, unknown>;
}

export interface WebhookPayload {
    event: string;
    data: Record<string, unknown>;
    timestamp: string;
}

export interface ExecutionSummary {
    executionId: string;
    workflowId: string;
    status: 'success' | 'failure' | 'partial';
    startedAt: Date;
    completedAt: Date;
    results: unknown[];
}