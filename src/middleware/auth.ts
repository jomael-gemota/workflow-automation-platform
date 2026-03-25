import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiKeyModel } from '../db/models/ApiKeyModel';
import { UnauthorizedError, ForbiddenError } from '../errors/ApiError';

export async function apiKeyAuth(
    request: FastifyRequest,
    _reply: FastifyReply
): Promise<void> {
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
        throw UnauthorizedError();
    }

    const doc = await ApiKeyModel.findOne({ key: apiKey });
    if (!doc) throw ForbiddenError();

    (request as any).apiKey = { id: doc.keyId, key: doc.key, name: doc.name };
}