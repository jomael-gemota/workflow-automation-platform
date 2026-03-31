import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { BasecampAuthService } from '../services/BasecampAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

const USER_AGENT = 'WorkflowAutomationPlatform (basecamp-integration)';

type BasecampAction =
    | 'create_todo'
    | 'complete_todo'
    | 'post_message'
    | 'post_comment'
    | 'send_campfire'
    | 'list_todos';

interface BasecampConfig {
    credentialId: string;
    action: BasecampAction;
    projectId?: string;
    todolistId?: string;
    todoId?: string;
    recordingId?: string;
    // create_todo
    content?: string;
    description?: string;
    assigneeIds?: string;
    dueOn?: string;
    // post_message
    subject?: string;
    // list_todos
    completed?: boolean;
    // shared
    text?: string;
}

export class BasecampNode implements NodeExecutor {
    private auth: BasecampAuthService;
    private resolver = new ExpressionResolver();

    constructor(auth: BasecampAuthService) {
        this.auth = auth;
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as BasecampConfig;
        const { credentialId, action } = config;

        if (!credentialId) throw new Error('Basecamp node: credentialId is required');
        if (!action)       throw new Error('Basecamp node: action is required');

        const token     = await this.auth.getToken(credentialId);
        const accountId = await this.auth.getAccountId(credentialId);
        const baseUrl   = `https://3.basecampapi.com/${accountId}`;

        const headers = {
            Authorization:  `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent':   USER_AGENT,
        };

        if (action === 'create_todo') {
            const todolistId = this.resolver.resolveTemplate(config.todolistId ?? '', context);
            const content    = this.resolver.resolveTemplate(config.content ?? '', context);
            if (!todolistId) throw new Error('Basecamp create_todo: todolistId is required');
            if (!content)    throw new Error('Basecamp create_todo: content is required');

            const description = this.resolver.resolveTemplate(config.description ?? '', context);
            const dueOn       = this.resolver.resolveTemplate(config.dueOn ?? '', context);
            const rawAssignees = this.resolver.resolveTemplate(config.assigneeIds ?? '', context);
            const assigneeIds = rawAssignees
                ? rawAssignees.split(',').map((id) => Number(id.trim())).filter(Boolean)
                : [];

            const body: Record<string, unknown> = { content };
            if (description) body.description = description;
            if (dueOn)       body.due_on = dueOn;
            if (assigneeIds.length > 0) {
                body.assignee_ids = assigneeIds;
                body.notify = true;
            }

            const res = await fetch(`${baseUrl}/todolists/${todolistId}/todos.json`, {
                method: 'POST', headers, body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Basecamp create_todo failed (${res.status}): ${await res.text()}`);
            const todo = await res.json();
            return { id: (todo as Record<string, unknown>).id, title: content, status: 'created' };
        }

        if (action === 'complete_todo') {
            const todoId = this.resolver.resolveTemplate(config.todoId ?? '', context);
            if (!todoId) throw new Error('Basecamp complete_todo: todoId is required');

            const res = await fetch(`${baseUrl}/todos/${todoId}/completion.json`, {
                method: 'POST', headers,
            });
            if (!res.ok && res.status !== 204) {
                throw new Error(`Basecamp complete_todo failed (${res.status}): ${await res.text()}`);
            }
            return { todoId, completed: true };
        }

        if (action === 'post_message') {
            const projectId = this.resolver.resolveTemplate(config.projectId ?? '', context);
            const subject   = this.resolver.resolveTemplate(config.subject ?? '', context);
            const content   = this.resolver.resolveTemplate(config.text ?? '', context);
            if (!projectId) throw new Error('Basecamp post_message: projectId is required');
            if (!subject)   throw new Error('Basecamp post_message: subject is required');

            // Fetch project to get message_board ID from the dock
            const projRes = await fetch(`${baseUrl}/projects/${projectId}.json`, { headers });
            if (!projRes.ok) throw new Error(`Basecamp: failed to fetch project (${projRes.status})`);
            const project = await projRes.json() as { dock: Array<{ name: string; id: number; enabled: boolean }> };
            const board = project.dock.find((d) => d.name === 'message_board' && d.enabled);
            if (!board) throw new Error('Basecamp: Message Board is not enabled for this project.');

            const body = { subject, content: content || '', status: 'active' };
            const res = await fetch(`${baseUrl}/message_boards/${board.id}/messages.json`, {
                method: 'POST', headers, body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Basecamp post_message failed (${res.status}): ${await res.text()}`);
            const msg = await res.json() as Record<string, unknown>;
            return { id: msg.id, subject, status: 'posted' };
        }

        if (action === 'post_comment') {
            const recordingId = this.resolver.resolveTemplate(config.recordingId ?? '', context);
            const content     = this.resolver.resolveTemplate(config.text ?? '', context);
            if (!recordingId) throw new Error('Basecamp post_comment: recordingId is required');
            if (!content)     throw new Error('Basecamp post_comment: content is required');

            const res = await fetch(`${baseUrl}/recordings/${recordingId}/comments.json`, {
                method: 'POST', headers, body: JSON.stringify({ content }),
            });
            if (!res.ok) throw new Error(`Basecamp post_comment failed (${res.status}): ${await res.text()}`);
            const comment = await res.json() as Record<string, unknown>;
            return { id: comment.id, recordingId, status: 'commented' };
        }

        if (action === 'send_campfire') {
            const projectId = this.resolver.resolveTemplate(config.projectId ?? '', context);
            const content   = this.resolver.resolveTemplate(config.text ?? '', context);
            if (!projectId) throw new Error('Basecamp send_campfire: projectId is required');
            if (!content)   throw new Error('Basecamp send_campfire: content is required');

            const projRes = await fetch(`${baseUrl}/projects/${projectId}.json`, { headers });
            if (!projRes.ok) throw new Error(`Basecamp: failed to fetch project (${projRes.status})`);
            const project = await projRes.json() as { dock: Array<{ name: string; id: number; enabled: boolean }> };
            const chat = project.dock.find((d) => d.name === 'chat' && d.enabled);
            if (!chat) throw new Error('Basecamp: Campfire (Chat) is not enabled for this project.');

            const res = await fetch(`${baseUrl}/chats/${chat.id}/lines.json`, {
                method: 'POST', headers, body: JSON.stringify({ content }),
            });
            if (!res.ok) throw new Error(`Basecamp send_campfire failed (${res.status}): ${await res.text()}`);
            const line = await res.json() as Record<string, unknown>;
            return { id: line.id, status: 'sent' };
        }

        if (action === 'list_todos') {
            const todolistId = this.resolver.resolveTemplate(config.todolistId ?? '', context);
            if (!todolistId) throw new Error('Basecamp list_todos: todolistId is required');

            const completedParam = config.completed ? '?completed=true' : '';
            const res = await fetch(`${baseUrl}/todolists/${todolistId}/todos.json${completedParam}`, { headers });
            if (!res.ok) throw new Error(`Basecamp list_todos failed (${res.status}): ${await res.text()}`);
            const todos = await res.json() as Array<Record<string, unknown>>;
            return {
                todos: todos.map((t) => ({
                    id:        t.id,
                    title:     t.title ?? t.content,
                    completed: t.completed,
                    dueOn:     t.due_on,
                    assignees: ((t.assignees as Array<{ id: number; name: string }>) ?? []).map((a) => ({ id: a.id, name: a.name })),
                })),
                count: todos.length,
            };
        }

        throw new Error(`Basecamp node: unknown action "${action}"`);
    }
}
