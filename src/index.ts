import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

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

import { getDatabase } from './db/database';
import crypto from 'crypto';

import sensible from '@fastify/sensible';
import { registerErrorHandler } from './errors/errorHandler';

import { ConditionNode } from './nodes/ConditionNode';
import { SwitchNode } from './nodes/SwitchNode';
import { runSeeds } from './db/seeds';

async function bootstrap() {
    // 1. Engine setup
    const registry = new NodeExecutorRegistry();
    const memoryManager = new ChatMemoryManager();
    registry.register('http', new HttpNode());
    registry.register('llm', new LLMNode(memoryManager));
	registry.register('condition', new ConditionNode());
	registry.register('switch', new SwitchNode());
    const runner = new WorkflowRunner(registry);

    // 2. Repositories & services
    const workflowRepo = new WorkflowRepository();
    const executionRepo = new ExecutionRepository();
    const workflowService = new WorkflowService(runner, workflowRepo, executionRepo);

	runSeeds(workflowRepo);

    // 3. Seed a default API key on first run if none exist
    const db = getDatabase();
    const existing = db.prepare('SELECT COUNT(*) as count FROM api_keys').get() as { count: number };
    if (existing.count === 0) {
      const defaultKey = `sk-${crypto.randomUUID()}`;
      db.prepare('INSERT INTO api_keys (id, key, name) VALUES (?, ?, ?)')
        .run(crypto.randomUUID(), defaultKey, 'default');
      console.log(`\n🔑 Default API Key generated (save this — shown once):\n   ${defaultKey}\n`);
    }

    // 4. Fastify server
    const fastify = Fastify({
		logger: true,
		genReqId: () => crypto.randomUUID(),
	});

    await fastify.register(helmet);
    await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });
	await fastify.register(sensible);

    // 5. Register routes
	registerErrorHandler(fastify);
    await fastify.register(workflowRoutes, { workflowService, workflowRepo });
    await fastify.register(executionRoutes, { executionRepo });
    await fastify.register(webhookRoutes, { workflowService, workflowRepo });

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