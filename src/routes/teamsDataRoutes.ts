import { FastifyInstance } from 'fastify';
import { Client } from '@microsoft/microsoft-graph-client';
import { TeamsAuthService } from '../services/TeamsAuthService';

export async function teamsDataRoutes(
    fastify: FastifyInstance,
    options: { teamsAuth: TeamsAuthService }
): Promise<void> {
    const { teamsAuth } = options;

    function getClient(token: string): Client {
        return Client.init({
            authProvider: (done) => done(null, token),
        });
    }

    /** List all Microsoft Teams the authenticated user is a member of */
    fastify.get<{ Querystring: { credentialId: string } }>(
        '/teams/teams',
        async (request, reply) => {
            const { credentialId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');

            const token  = await teamsAuth.getToken(credentialId);
            const client = getClient(token);

            type TeamEntry = { id: string; displayName: string; description: string | null };
            const allTeams: TeamEntry[] = [];
            let nextLink: string | undefined;

            do {
                const res = nextLink
                    ? await client.api(nextLink).get() as { value: Array<Record<string, unknown>>; '@odata.nextLink'?: string }
                    : await client.api('/me/joinedTeams').select('id,displayName,description').get() as { value: Array<Record<string, unknown>>; '@odata.nextLink'?: string };

                for (const t of res.value ?? []) {
                    allTeams.push({
                        id:          t.id as string,
                        displayName: t.displayName as string,
                        description: (t.description as string | null) ?? null,
                    });
                }

                nextLink = res['@odata.nextLink'] as string | undefined;
            } while (nextLink);

            allTeams.sort((a, b) => a.displayName.localeCompare(b.displayName));

            return reply.send({ teams: allTeams });
        }
    );

    /** List all channels for a given team */
    fastify.get<{ Querystring: { credentialId: string; teamId: string } }>(
        '/teams/channels',
        async (request, reply) => {
            const { credentialId, teamId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');
            if (!teamId)       return reply.badRequest('teamId is required');

            const token  = await teamsAuth.getToken(credentialId);
            const client = getClient(token);

            type ChannelEntry = { id: string; displayName: string; membershipType: string };
            const allChannels: ChannelEntry[] = [];
            let nextLink: string | undefined;

            do {
                const res = nextLink
                    ? await client.api(nextLink).get() as { value: Array<Record<string, unknown>>; '@odata.nextLink'?: string }
                    : await client.api(`/teams/${teamId}/channels`).select('id,displayName,membershipType').get() as { value: Array<Record<string, unknown>>; '@odata.nextLink'?: string };

                for (const c of res.value ?? []) {
                    allChannels.push({
                        id:             c.id as string,
                        displayName:    c.displayName as string,
                        membershipType: (c.membershipType as string) ?? 'standard',
                    });
                }

                nextLink = res['@odata.nextLink'] as string | undefined;
            } while (nextLink);

            // General channel first, then alphabetical
            allChannels.sort((a, b) => {
                if (a.displayName === 'General') return -1;
                if (b.displayName === 'General') return  1;
                return a.displayName.localeCompare(b.displayName);
            });

            return reply.send({ channels: allChannels });
        }
    );

    /** List users in the organisation (for DMs) */
    fastify.get<{ Querystring: { credentialId: string } }>(
        '/teams/users',
        async (request, reply) => {
            const { credentialId } = request.query;
            if (!credentialId) return reply.badRequest('credentialId is required');

            const token  = await teamsAuth.getToken(credentialId);
            const client = getClient(token);

            type UserEntry = { id: string; displayName: string; mail: string; userPrincipalName: string };
            const allUsers: UserEntry[] = [];
            let nextLink: string | undefined;

            do {
                const res = nextLink
                    ? await client.api(nextLink).get() as { value: Array<Record<string, unknown>>; '@odata.nextLink'?: string }
                    : await client
                        .api('/users')
                        .select('id,displayName,mail,userPrincipalName')
                        .filter("accountEnabled eq true and userType eq 'Member'")
                        .top(100)
                        .get() as { value: Array<Record<string, unknown>>; '@odata.nextLink'?: string };

                for (const u of res.value ?? []) {
                    allUsers.push({
                        id:                u.id as string,
                        displayName:       (u.displayName as string) ?? '',
                        mail:              (u.mail as string) ?? '',
                        userPrincipalName: (u.userPrincipalName as string) ?? '',
                    });
                }

                nextLink = res['@odata.nextLink'] as string | undefined;
            } while (nextLink);

            allUsers.sort((a, b) => a.displayName.localeCompare(b.displayName));

            return reply.send(allUsers);
        }
    );
}
