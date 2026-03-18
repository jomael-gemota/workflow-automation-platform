import { FastifyInstance } from 'fastify';
import { WorkflowService } from '../services/WorkflowService';
import { WebhookPayload } from '../types/api.types';

export async function webhookRoutes(
    fastify: FastifyInstance,
    options: { workflowService: WorkflowService }
): Promise<void> {
    const { workflowService } = options;

    fastify.post<{ Params: { workflowId: string }; Body: WebhookPayload }>(
        '/webhooks/:workflowId',
        async (request, reply) => {
            const { workflowId } = request.params;
            const payload = request.body;

            try {
                const summary = await workflowService.trigger(workflowId, {
                    event: payload.event,
                    data: payload.data,
                    receivedAt: new Date().toISOString(),
                });

                return reply.code(200).send({
                    received: true,
                    executionId: summary.executionId,
                    status: summary.status,
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                return reply.code(404).send({ error: message });
            }
        }
    );
}