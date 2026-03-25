import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createHmacVerifier } from '../../middleware/hmac';
import { FastifyRequest, FastifyReply } from 'fastify';

const SECRET = 'test-secret-123';

function makeRepo(secret: string | null = SECRET) {
    return { findWebhookSecret: vi.fn().mockResolvedValue(secret) } as any;
}

function makeRequest(
    workflowId: string,
    body: unknown,
    signature: string | undefined
): FastifyRequest {
    return {
        params: { workflowId },
        headers: signature ? { 'x-webhook-signature': signature } : {},
        body,
    } as unknown as FastifyRequest;
}

function buildSignature(secret: string, body: unknown): string {
    const hex = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    return `sha256=${hex}`;
}

const reply = {} as FastifyReply;

describe('createHmacVerifier', () => {
    beforeEach(() => vi.clearAllMocks());

    it('throws UnauthorizedError when signature header is missing', async () => {
        const verifier = createHmacVerifier(makeRepo());
        const req = makeRequest('wf-1', { event: 'test' }, undefined);
        await expect(verifier(req, reply)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws UnauthorizedError when webhook secret is not found', async () => {
        const verifier = createHmacVerifier(makeRepo(null));
        const body = { event: 'test', data: {}, timestamp: new Date().toISOString() };
        const req = makeRequest('wf-1', body, buildSignature(SECRET, body));
        await expect(verifier(req, reply)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('passes when signature is valid', async () => {
        const verifier = createHmacVerifier(makeRepo());
        const body = { event: 'test', data: {}, timestamp: new Date().toISOString() };
        const req = makeRequest('wf-1', body, buildSignature(SECRET, body));
        await expect(verifier(req, reply)).resolves.toBeUndefined();
    });

    it('throws 403 when signature is incorrect', async () => {
        const verifier = createHmacVerifier(makeRepo());
        const body = { event: 'test', data: {}, timestamp: new Date().toISOString() };
        const req = makeRequest('wf-1', body, 'sha256=invalidsignature00000000000000000000000000000000000000000000000000');
        await expect(verifier(req, reply)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 403 when signature has wrong prefix format', async () => {
        const verifier = createHmacVerifier(makeRepo());
        const body = { event: 'test', data: {}, timestamp: new Date().toISOString() };
        const req = makeRequest('wf-1', body, 'md5=abc123');
        await expect(verifier(req, reply)).rejects.toMatchObject({ statusCode: 403 });
    });
});
