import { FastifyInstance } from 'fastify';
import { WebClient } from '@slack/web-api';
import { SlackAuthService } from '../services/SlackAuthService';

export async function slackDataRoutes(
    fastify: FastifyInstance,
    options: { slackAuth: SlackAuthService }
): Promise<void> {
    const { slackAuth } = options;

    /** List all channels visible to the connected credential (paginated) */
    fastify.get<{ Querystring: { credentialId: string } }>(
        '/slack/channels',
        async (request, reply) => {
            const { credentialId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');

            const token  = await slackAuth.getToken(credentialId);
            const client = new WebClient(token);

            type ChannelEntry = { id: string; name: string; isPrivate: boolean; isMember: boolean };
            const allChannels: ChannelEntry[] = [];
            const missingScopes: string[]     = [];

            /**
             * Paginate all pages for one channel type.
             * If the token lacks the required scope, records it in missingScopes
             * and returns without throwing so the other type still loads.
             */
            async function fetchChannelPages(
                type: 'public_channel' | 'private_channel',
                requiredScope: string,
            ): Promise<void> {
                let cursor: string | undefined;
                try {
                    do {
                        const page = await client.conversations.list({
                            types:            type,
                            limit:            200,
                            exclude_archived: true,
                            ...(cursor ? { cursor } : {}),
                        });

                        for (const c of page.channels ?? []) {
                            allChannels.push({
                                id:        c.id!,
                                name:      c.name!,
                                isPrivate: c.is_private ?? false,
                                isMember:  c.is_member  ?? false,
                            });
                        }

                        cursor = page.response_metadata?.next_cursor || undefined;
                    } while (cursor);
                } catch (err: any) {
                    const code: string = err?.data?.error ?? '';
                    if (code === 'missing_scope' || code === 'not_allowed_token_type') {
                        missingScopes.push(requiredScope);
                        return;
                    }
                    throw err;
                }
            }

            // Run both types in parallel — a scope failure on one never blocks the other
            await Promise.all([
                fetchChannelPages('public_channel',  'channels:read'),
                fetchChannelPages('private_channel', 'groups:read'),
            ]);

            // Joined channels first, then alphabetical within each group
            allChannels.sort((a, b) => {
                if (a.isMember !== b.isMember) return a.isMember ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            return reply.send({ channels: allChannels, missingScopes });
        }
    );

    /** List all non-bot, non-deleted users in the workspace (paginated) */
    fastify.get<{ Querystring: { credentialId: string } }>(
        '/slack/users',
        async (request, reply) => {
            const { credentialId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');

            const token  = await slackAuth.getToken(credentialId);
            const client = new WebClient(token);

            type UserEntry = { id: string; name: string; realName: string; displayName: string };
            const allUsers: UserEntry[] = [];
            let cursor: string | undefined;

            do {
                const page = await client.users.list({
                    limit: 200,
                    ...(cursor ? { cursor } : {}),
                });

                for (const u of page.members ?? []) {
                    if (u.deleted || u.is_bot || u.id === 'USLACKBOT') continue;
                    allUsers.push({
                        id:          u.id!,
                        name:        u.name!,
                        realName:    u.real_name  ?? u.name!,
                        displayName: u.profile?.display_name || u.real_name || u.name!,
                    });
                }

                cursor = page.response_metadata?.next_cursor || undefined;
            } while (cursor);

            allUsers.sort((a, b) =>
                (a.displayName || a.name).localeCompare(b.displayName || b.name)
            );

            return reply.send(allUsers);
        }
    );
}
