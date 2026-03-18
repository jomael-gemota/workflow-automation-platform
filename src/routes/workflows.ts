import { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/auth';
import { WorkflowService } from '../services/WorkflowService';
import { WorkflowRepository } from '../repositories/WorkflowRepository';
import { TriggerWorkflowBody } from '../types/api.types';

export async function workflowRoutes(
    fastify: FastifyInstance,
    options: { workflowService: WorkflowService; workflowRepo: WorkflowRepository }
): Promise<void> {
    const { workflowService, workflowRepo } = options;

    fastify.post<{ Body: TriggerWorkflowBody }>(
        '/workflows/trigger',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
        const { workflowId, input = {} } = request.body;

        if (!workflowId) {
            return reply.code(400).send({ error: 'workflowId is required' });
        }

        try {
            const summary = await workflowService.trigger(workflowId, input);
            return reply.code(200).send(summary);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return reply.code(404).send({ error: message });
        }
        }
    );

    fastify.get(
        '/workflows',
        { preHandler: apiKeyAuth },
        async (_request, reply) => {
        const workflows = workflowRepo.findAll();
        return reply.code(200).send(workflows);
        }
    );

    fastify.get<{ Params: { id: string } }>(
        '/workflows/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
        const workflow = workflowRepo.findById(request.params.id);
        if (!workflow) return reply.code(404).send({ error: 'Workflow not found' });
        return reply.code(200).send(workflow);
        }
    );
}