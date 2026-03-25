import { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/auth';
import { ExecutionRepository } from '../repositories/ExecutionRepository';
import { WorkflowService } from '../services/WorkflowService';
import { CursorPaginationSchema } from '../validation/schemas';
import { toJsonSchema } from '../validation/toJsonSchema';
import { NotFoundError } from '../errors/ApiError';

export async function executionRoutes(
    fastify: FastifyInstance,
    options: {
        executionRepo: ExecutionRepository;
        workflowService: WorkflowService;
    }
): Promise<void> {
    const { executionRepo, workflowService } = options;

    fastify.get<{ Params: { id: string } }>(
        '/executions/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const execution = await executionRepo.findById(request.params.id);
            if (!execution) throw NotFoundError(`Execution ${request.params.id}`);
            return reply.code(200).send(execution);
        }
    );

    fastify.get<{ Querystring: { workflowId?: string; limit?: number; cursor?: string } }>(
        '/executions',
        {
            preHandler: apiKeyAuth,
            schema: { querystring: toJsonSchema(CursorPaginationSchema) },
        },
        async (request, reply) => {
            const { workflowId, limit = 20, cursor } = request.query;
            if (!workflowId) throw NotFoundError('workflowId query param is required');

            const result = await executionRepo.findByWorkflowIdPaginated(
                workflowId,
                limit,
                cursor
            );
            return reply.code(200).send(result);
        }
    );

    fastify.post<{ Params: { id: string } }>(
        '/executions/:id/replay',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            try {
                const summary = await workflowService.replay(request.params.id);
                return reply.code(200).send(summary);
            } catch {
                throw NotFoundError(`Execution ${request.params.id}`);
            }
        }
    );
}