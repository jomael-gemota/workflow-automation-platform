import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { apiKeyAuth } from '../middleware/auth';
import { ApiKeyModel } from '../db/models/ApiKeyModel';
import { NotFoundError } from '../errors/ApiError';

export async function apiKeyRoutes(fastify: FastifyInstance): Promise<void> {

    fastify.post(
        '/api-keys',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const body = request.body as { name?: string } | undefined;
            const name = (body?.name && typeof body.name === 'string') ? body.name : 'unnamed';

            const rawKey = `sk-${crypto.randomUUID()}`;
            const keyId = crypto.randomUUID();

            await ApiKeyModel.create({ keyId, key: rawKey, name });

            return reply.code(201).send({
                keyId,
                name,
                key: rawKey,
                note: 'Save this key — it will not be shown again.',
            });
        }
    );

    fastify.get(
        '/api-keys',
        { preHandler: apiKeyAuth },
        async (_request, reply) => {
            const docs = await ApiKeyModel.find().select('keyId name createdAt').sort({ createdAt: -1 });
            const keys = docs.map(d => ({
                keyId: d.keyId,
                name: d.name,
                createdAt: d.createdAt,
            }));
            return reply.code(200).send({ data: keys, total: keys.length });
        }
    );

    fastify.delete<{ Params: { id: string } }>(
        '/api-keys/:id',
        { preHandler: apiKeyAuth },
        async (request, reply) => {
            const result = await ApiKeyModel.deleteOne({ keyId: request.params.id });
            if (result.deletedCount === 0) throw NotFoundError(`API key ${request.params.id}`);
            return reply.code(200).send({ deleted: true, keyId: request.params.id });
        }
    );
}
