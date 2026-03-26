import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';

import { WorkflowRunner } from './engine/WorkflowRunner';
import { NodeExecutorRegistry } from './engine/NodeExecutorRegistry';
import { HttpNode } from './nodes/HttpNode';
import { LLMNode } from './nodes/LLMNode';
import { ChatMemoryManager } from './llm/ChatMemoryManager';

import { WorkflowRepository } from './repositories/WorkflowRepository';
import { ExecutionRepository } from './repositories/ExecutionRepository';
import { WorkflowService } from './services/WorkflowService';

import { workflowRoutes } from './routes/workflows';
import { executionRoutes } from './routes/executions';
import { webhookRoutes } from './routes/webhooks';
import { apiKeyRoutes } from './routes/apiKeys';

import { connectDatabase } from './db/database';
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
    const workflowRepo = new WorkflowRepository();
    const executionRepo = new ExecutionRepository();
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

    // 5. Register routes
	registerErrorHandler(fastify);
    await fastify.register(workflowRoutes, { workflowService, workflowRepo, executionRepo, registry });
    await fastify.register(executionRoutes, { executionRepo, workflowService });
    await fastify.register(webhookRoutes, { workflowService, workflowRepo });
    await fastify.register(apiKeyRoutes);

    // 6. Health check
    fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // 7. Start
    const PORT = Number(process.env.PORT ?? 3000);
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Platform running at http://localhost:${PORT}`);
}

bootstrap().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});