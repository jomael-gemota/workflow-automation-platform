import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { ExpressionResolver } from '../engine/ExpressionResolver';

export class HttpNode implements NodeExecutor {
    private resolver = new ExpressionResolver();

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const { url, method = 'GET', body, headers: customHeaders } = node.config as {
            url: string;
            method?: string;
            body?: unknown;
            headers?: Record<string, string>;
        };

        // Resolve expressions in the URL
        const resolvedUrl = this.resolver.resolveTemplate(url, context);

        // Resolve expressions in each header value
        const resolvedCustomHeaders: Record<string, string> = {};
        if (customHeaders) {
            for (const [key, value] of Object.entries(customHeaders)) {
                resolvedCustomHeaders[key] = this.resolver.resolveTemplate(String(value), context);
            }
        }

        // Resolve expressions in the body
        const resolvedBody = body != null ? this.resolveBody(body, context) : undefined;
        const hasBody = resolvedBody !== undefined && method !== 'GET' && method !== 'HEAD';

        // Only send Content-Type when there is actually a body to describe.
        // Sending Content-Type on a GET/HEAD with no body causes many APIs to return 400.
        const headers: Record<string, string> = {
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            ...resolvedCustomHeaders,
        };

        const response = await fetch(resolvedUrl, {
            method,
            headers,
            body: hasBody ? JSON.stringify(resolvedBody) : undefined,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            return { status: response.status, body: await response.json(), headers: Object.fromEntries(response.headers) };
        }
        return { status: response.status, body: await response.text(), headers: Object.fromEntries(response.headers) };
    }

    private resolveBody(body: unknown, context: ExecutionContext): unknown {
        if (typeof body === 'string') {
            // Could be a raw expression like {{nodes.x.body}} or a JSON string
            const resolved = this.resolver.resolve(body, context);
            return resolved;
        }
        if (Array.isArray(body)) {
            return body.map(item => this.resolveBody(item, context));
        }
        if (body !== null && typeof body === 'object') {
            const result: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
                result[k] = this.resolveBody(v, context);
            }
            return result;
        }
        return body;
    }
}