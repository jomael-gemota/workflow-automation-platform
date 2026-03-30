import { Client } from '@microsoft/microsoft-graph-client';
import { NodeExecutor } from '../engine/NodeExecutor';
import { WorkflowNode, ExecutionContext } from '../types/workflow.types';
import { TeamsAuthService } from '../services/TeamsAuthService';
import { ExpressionResolver } from '../engine/ExpressionResolver';

type TeamsAction = 'send_message' | 'send_dm' | 'read_messages';

interface TeamsConfig {
    credentialId: string;
    action: TeamsAction;
    // send_message / read_messages
    teamId?: string;
    channelId?: string;
    // send_message / send_dm
    text?: string;
    // send_dm
    userId?: string;
    // read_messages
    limit?: number;
}

export class TeamsNode implements NodeExecutor {
    private teamsAuth: TeamsAuthService;
    private resolver = new ExpressionResolver();

    constructor(teamsAuth: TeamsAuthService) {
        this.teamsAuth = teamsAuth;
    }

    private async getClient(credentialId: string): Promise<Client> {
        const token = await this.teamsAuth.getToken(credentialId);
        return Client.init({
            authProvider: (done) => done(null, token),
        });
    }

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
        const config = node.config as unknown as TeamsConfig;
        const { credentialId, action } = config;

        if (!credentialId) throw new Error('Teams node: credentialId is required');
        if (!action)       throw new Error('Teams node: action is required');

        const client = await this.getClient(credentialId);

        if (action === 'send_message') {
            const teamId    = this.resolver.resolveTemplate(config.teamId    ?? '', context);
            const channelId = this.resolver.resolveTemplate(config.channelId ?? '', context);
            const text      = this.resolver.resolveTemplate(config.text      ?? '', context);

            if (!teamId)    throw new Error('Teams send_message: teamId is required');
            if (!channelId) throw new Error('Teams send_message: channelId is required');
            if (!text)      throw new Error('Teams send_message: text is required');

            const res = await client
                .api(`/teams/${teamId}/channels/${channelId}/messages`)
                .post({
                    body: {
                        contentType: 'text',
                        content:     text,
                    },
                });

            return {
                id:        res.id,
                teamId,
                channelId,
                createdAt: res.createdDateTime,
            };
        }

        if (action === 'send_dm') {
            const userId = this.resolver.resolveTemplate(config.userId ?? '', context);
            const text   = this.resolver.resolveTemplate(config.text   ?? '', context);

            if (!userId) throw new Error('Teams send_dm: userId is required');
            if (!text)   throw new Error('Teams send_dm: text is required');

            // Get or create a 1:1 chat with the target user.
            // First resolve the current user's ID.
            const me = await client.api('/me').get() as { id: string };

            const chat = await client.api('/chats').post({
                chatType: 'oneOnOne',
                members: [
                    {
                        '@odata.type':     '#microsoft.graph.aadUserConversationMember',
                        roles:             ['owner'],
                        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${me.id}')`,
                    },
                    {
                        '@odata.type':     '#microsoft.graph.aadUserConversationMember',
                        roles:             ['owner'],
                        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${userId}')`,
                    },
                ],
            }) as { id: string };

            const message = await client.api(`/chats/${chat.id}/messages`).post({
                body: {
                    contentType: 'text',
                    content:     text,
                },
            }) as { id: string; createdDateTime: string };

            return {
                id:        message.id,
                chatId:    chat.id,
                createdAt: message.createdDateTime,
            };
        }

        if (action === 'read_messages') {
            const teamId    = this.resolver.resolveTemplate(config.teamId    ?? '', context);
            const channelId = this.resolver.resolveTemplate(config.channelId ?? '', context);
            const limit     = config.limit ?? 10;

            if (!teamId)    throw new Error('Teams read_messages: teamId is required');
            if (!channelId) throw new Error('Teams read_messages: channelId is required');

            const res = await client
                .api(`/teams/${teamId}/channels/${channelId}/messages`)
                .top(limit)
                .get() as { value: Array<Record<string, unknown>> };

            const messages = (res.value ?? []).map((m) => ({
                id:        m.id,
                text:      (m.body as { content?: string } | undefined)?.content,
                from:      (m.from as { user?: { displayName?: string } } | undefined)?.user?.displayName,
                createdAt: m.createdDateTime,
            }));

            return { messages, count: messages.length };
        }

        throw new Error(`Teams node: unknown action "${action}"`);
    }
}
