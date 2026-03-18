import { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/auth';
import { ExecutionRepository } from '../repositories/ExecutionRepository';

export async function executionRoutes(
    fastify: FastifyInstance,
    options: { executionRepo: ExecutionRepository }
): Promise<void> {
    const { executionRepo } = options;

    fastify.get<{ Params: { id: string } }>(
        '/executions/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
        const execution = executionRepo.findById(request.params.id);
        if (!execution) return reply.code(404).send({ error: 'Execution not found' });
        return reply.code(200).send(execution);
        }
    );

    fastify.get<{ Querystring: { workflowId?: string } }>(
        '/executions',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
        const { workflowId } = request.query;
        if (!workflowId) return reply.code(400).send({ error: 'workflowId query param is required' });

        const executions = executionRepo.findByWorkflowId(workflowId);
        return reply.code(200).send(executions);
        }
    );
}