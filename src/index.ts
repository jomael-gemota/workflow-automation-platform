import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'fs';
import { join } from 'path';

import { WorkflowRunner } from './engine/WorkflowRunner';
import { NodeExecutorRegistry } from './engine/NodeExecutorRegistry';
import { HttpNode } from './nodes/HttpNode';
import { LLMNode } from './nodes/LLMNode';
import { ChatMemoryManager } from './llm/ChatMemoryManager';
import { GmailNode } from './nodes/GmailNode';
import { GDriveNode } from './nodes/GDriveNode';
import { GDocsNode } from './nodes/GDocsNode';
import { GSheetsNode } from './nodes/GSheetsNode';
import { SlackNode } from './nodes/SlackNode';

import { WorkflowRepository } from './repositories/WorkflowRepository';
import { ExecutionRepository } from './repositories/ExecutionRepository';
import { CredentialRepository } from './repositories/CredentialRepository';
import { WorkflowService } from './services/WorkflowService';
import { GoogleAuthService } from './services/GoogleAuthService';
import { SlackAuthService } from './services/SlackAuthService';

import { workflowRoutes } from './routes/workflows';
import { executionRoutes } from './routes/executions';
import { webhookRoutes } from './routes/webhooks';
import { apiKeyRoutes } from './routes/apiKeys';
import { oauthRoutes } from './routes/oauthRoutes';
import { credentialRoutes } from './routes/credentialRoutes';
import { slackDataRoutes } from './routes/slackDataRoutes';

import { connectDatabase } from './db/database';
import { getBaseUrl } from './utils/baseUrl';
import crypto from 'crypto';

import sensible from '@fastify/sensible';
import { registerErrorHandler } from './errors/errorHandler';

import { ConditionNode } from './nodes/ConditionNode';
import { SwitchNode } from './nodes/SwitchNode';
import { TransformNode } from './nodes/TransformNode';
import { OutputNode } from './nodes/OutputNode';
import { runSeeds } from './db/seeds';

import { ApiKeyModel } from './db/models/ApiKeyModel';
import { createWorkflowWorker } from './queue/WorkflowWorker';
import { WorkflowScheduler } from './scheduler/WorkflowScheduler';

async function bootstrap() {

    await connectDatabase();
    
    // 1. Engine setup
    const registry = new NodeExecutorRegistry();
    const memoryManager = new ChatMemoryManager();
    registry.register('http', new HttpNode());
    registry.register('llm', new LLMNode(memoryManager));
	registry.register('condition', new ConditionNode());
	registry.register('switch', new SwitchNode());
    registry.register('transform', new TransformNode());
    registry.register('output', new OutputNode());
    const runner = new WorkflowRunner(registry);

    // 2. Repositories & services
    const workflowRepo    = new WorkflowRepository();
    const executionRepo   = new ExecutionRepository();
    const credentialRepo  = new CredentialRepository();
    const googleAuth      = new GoogleAuthService(credentialRepo);
    const slackAuth       = new SlackAuthService(credentialRepo);
    registry.register('gmail',   new GmailNode(googleAuth));
    registry.register('gdrive',  new GDriveNode(googleAuth));
    registry.register('gdocs',   new GDocsNode(googleAuth));
    registry.register('gsheets', new GSheetsNode(googleAuth));
    registry.register('slack',   new SlackNode(slackAuth));
    const workflowService = new WorkflowService(runner, workflowRepo, executionRepo);

	await runSeeds(workflowRepo);

    // 3. Start background worker (only when Redis is available)
    if (process.env.REDIS_URL) {
        createWorkflowWorker(runner, workflowRepo, executionRepo);
    } else {
        console.log('ℹ️  No REDIS_URL set — running without background worker (synchronous mode)');
    }

    // 4. Start cron scheduler
    const scheduler = new WorkflowScheduler(workflowRepo, workflowService);
    await scheduler.start();

    // 3. Seed a default API key on first run if none exist
    const existingKey = await ApiKeyModel.findOne();
    if (!existingKey) {
        const defaultKey = `sk-${crypto.randomUUID()}`;
        await ApiKeyModel.create({
        keyId: crypto.randomUUID(),
        key: defaultKey,
        name: 'default',
        });
        console.log(`\n🔑 Default API Key generated (save this — shown once):\n   ${defaultKey}\n`);
    }

    // 4. Fastify server
    const fastify = Fastify({
		logger: true,
		genReqId: () => crypto.randomUUID(),
	});

    await fastify.register(cors, { origin: process.env.CORS_ORIGIN ?? '*' });
    await fastify.register(helmet);
    await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });
	await fastify.register(sensible);

    // 5. Register routes (all API routes under /api prefix)
	registerErrorHandler(fastify);
    await fastify.register(workflowRoutes,   { prefix: '/api', workflowService, workflowRepo, executionRepo, registry });
    await fastify.register(executionRoutes,  { prefix: '/api', executionRepo, workflowService });
    await fastify.register(webhookRoutes,    { workflowService, workflowRepo });   // no prefix — called by external systems
    await fastify.register(apiKeyRoutes,     { prefix: '/api' });
    await fastify.register(oauthRoutes,      { prefix: '/api', googleAuth, slackAuth, credentialRepo });
    await fastify.register(credentialRoutes, { prefix: '/api', credentialRepo });
    await fastify.register(slackDataRoutes,  { prefix: '/api', slackAuth });

    // 6. Health check
    fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // 7. Serve frontend SPA in production (or when dist/public exists locally)
    const publicPath = join(__dirname, 'public');
    if (existsSync(publicPath)) {
        await fastify.register(fastifyStatic, { root: publicPath, prefix: '/' });
        fastify.setNotFoundHandler((req, reply) => {
            if (req.url.startsWith('/api/') || req.url.startsWith('/webhook/')) {
                reply.code(404).send({ message: `Route ${req.method}:${req.url} not found`, error: 'Not Found', statusCode: 404 });
            } else {
                reply.sendFile('index.html');
            }
        });
    }

    // 8. Start
    const PORT = Number(process.env.PORT ?? 3000);
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Platform running at ${getBaseUrl()}`);
}

bootstrap().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});