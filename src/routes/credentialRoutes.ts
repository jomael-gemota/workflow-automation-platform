import { FastifyInstance, FastifyRequest } from 'fastify';
import { apiKeyAuth } from '../middleware/auth';
import { CredentialRepository } from '../repositories/CredentialRepository';
import { NotFoundError } from '../errors/ApiError';

function getRequestUserId(request: FastifyRequest): string | undefined {
    return (request as any).user?.sub ?? undefined;
}

export async function credentialRoutes(
    fastify: FastifyInstance,
    options: { credentialRepo: CredentialRepository }
): Promise<void> {
    const { credentialRepo } = options;

    /** List credentials belonging to the requesting user (JWT) or all (API key) */
    fastify.get('/credentials', { preHandler: apiKeyAuth }, async (request, reply) => {
        const userId = getRequestUserId(request);
        const list = await credentialRepo.findAll(userId);
        return reply.code(200).send(list);
    });

    /** Delete (disconnect) a credential — scoped to the requesting user */
    fastify.delete<{ Params: { id: string } }>(
        '/credentials/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const userId = getRequestUserId(request);
            const deleted = await credentialRepo.deleteById(request.params.id, userId);
            if (!deleted) throw NotFoundError(`Credential ${request.params.id}`);
            return reply.code(200).send({ deleted: true, id: request.params.id });
        }
    );
}
