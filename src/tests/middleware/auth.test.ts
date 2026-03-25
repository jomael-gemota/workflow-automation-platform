import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiKeyAuth } from '../../middleware/auth';
import { FastifyRequest, FastifyReply } from 'fastify';

vi.mock('../../db/models/ApiKeyModel', () => ({
    ApiKeyModel: {
        findOne: vi.fn(),
    },
}));

import { ApiKeyModel } from '../../db/models/ApiKeyModel';

function makeRequest(headers: Record<string, string> = {}): FastifyRequest {
    return { headers } as unknown as FastifyRequest;
}

const reply = {} as FastifyReply;

describe('apiKeyAuth middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws UnauthorizedError when x-api-key header is missing', async () => {
        await expect(apiKeyAuth(makeRequest(), reply))
            .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws UnauthorizedError when x-api-key is not a string', async () => {
        const req = { headers: { 'x-api-key': ['key1', 'key2'] } } as unknown as FastifyRequest;
        await expect(apiKeyAuth(req, reply))
            .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws ForbiddenError when key is not found in database', async () => {
        vi.mocked(ApiKeyModel.findOne).mockResolvedValue(null);

        await expect(apiKeyAuth(makeRequest({ 'x-api-key': 'sk-invalid' }), reply))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    it('attaches apiKey to request when key is valid', async () => {
        vi.mocked(ApiKeyModel.findOne).mockResolvedValue({
            keyId: 'key-id-1',
            key: 'sk-valid',
            name: 'test-key',
        } as any);

        const req = makeRequest({ 'x-api-key': 'sk-valid' });
        await apiKeyAuth(req, reply);

        expect((req as any).apiKey).toEqual({ id: 'key-id-1', key: 'sk-valid', name: 'test-key' });
    });
});
