import { FastifyInstance } from 'fastify';
import { BasecampAuthService } from '../services/BasecampAuthService';

const USER_AGENT = 'WorkflowAutomationPlatform (basecamp-integration)';

export async function basecampDataRoutes(
    fastify: FastifyInstance,
    options: { basecampAuth: BasecampAuthService }
): Promise<void> {
    const { basecampAuth } = options;

    async function basecampFetch(credentialId: string, path: string) {
        const token     = await basecampAuth.getToken(credentialId);
        const accountId = await basecampAuth.getAccountId(credentialId);
        const url       = `https://3.basecampapi.com/${accountId}${path}`;

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent':  USER_AGENT,
            },
        });

        if (!res.ok) {
            throw new Error(`Basecamp API error (${res.status}): ${await res.text()}`);
        }

        return res.json();
    }

    fastify.get<{ Querystring: { credentialId: string } }>(
        '/basecamp/projects',
        async (request, reply) => {
            const { credentialId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');

            const projects = await basecampFetch(credentialId, '/projects.json') as Array<Record<string, unknown>>;
            return reply.send(
                projects.map((p) => ({
                    id:   p.id,
                    name: p.name,
                    description: p.description ?? '',
                }))
            );
        }
    );

    fastify.get<{ Querystring: { credentialId: string; projectId: string } }>(
        '/basecamp/todolists',
        async (request, reply) => {
            const { credentialId, projectId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');
            if (!projectId)    return reply.badRequest('projectId is required');

            // Fetch the project to find the todoset tool from the dock
            const project = await basecampFetch(credentialId, `/projects/${projectId}.json`) as {
                dock: Array<{ name: string; id: number; enabled: boolean; url?: string }>;
            };
            const todoset = project.dock.find((d) => d.name === 'todoset' && d.enabled);
            if (!todoset) {
                return reply.send([]);
            }

            const todolists = await basecampFetch(credentialId, `/todosets/${todoset.id}/todolists.json`) as Array<Record<string, unknown>>;
            return reply.send(
                todolists.map((tl) => ({
                    id:   tl.id,
                    name: tl.name ?? tl.title,
                    todosRemaining: tl.todos_remaining ?? 0,
                }))
            );
        }
    );

    fastify.get<{ Querystring: { credentialId: string; todolistId: string; completed?: string } }>(
        '/basecamp/todos',
        async (request, reply) => {
            const { credentialId, todolistId, completed } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');
            if (!todolistId)   return reply.badRequest('todolistId is required');

            const queryStr = completed === 'true' ? '?completed=true' : '';
            const todos = await basecampFetch(credentialId, `/todolists/${todolistId}/todos.json${queryStr}`) as Array<Record<string, unknown>>;
            return reply.send(
                todos.map((t) => ({
                    id:        t.id,
                    title:     t.title ?? t.content,
                    completed: t.completed,
                    dueOn:     t.due_on ?? null,
                }))
            );
        }
    );

    fastify.get<{ Querystring: { credentialId: string } }>(
        '/basecamp/people',
        async (request, reply) => {
            const { credentialId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');

            const people = await basecampFetch(credentialId, '/people.json') as Array<Record<string, unknown>>;
            return reply.send(
                people.map((p) => ({
                    id:    p.id,
                    name:  p.name,
                    email: p.email_address ?? '',
                }))
            );
        }
    );
}
