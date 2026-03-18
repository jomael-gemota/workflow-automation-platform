import { FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/database';

interface ApiKeyRow {
    id: string;
    key: string;
    name: string;
}

export async function apiKeyAuth(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
        reply.code(401).send({ error: 'Missing API key. Provide it via x-api-key header.' });
        return;
    }

    const db = getDatabase();
    const row = db
        .prepare('SELECT * FROM api_keys WHERE key = ?')
        .get(apiKey) as ApiKeyRow | undefined;

    if (!row) {
        reply.code(403).send({ error: 'Invalid API key.' });
        return;
    }

    (request as any).apiKey = row;
}