import { FastifyInstance } from 'fastify';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { SlackAuthService } from '../services/SlackAuthService';
import { TeamsAuthService } from '../services/TeamsAuthService';
import { CredentialRepository } from '../repositories/CredentialRepository';
import { getBaseUrl } from '../utils/baseUrl';

export async function oauthRoutes(
    fastify: FastifyInstance,
    options: { googleAuth: GoogleAuthService; slackAuth: SlackAuthService; teamsAuth: TeamsAuthService; credentialRepo: CredentialRepository }
): Promise<void> {
    const { googleAuth, slackAuth, teamsAuth, credentialRepo } = options;

    /** Check whether Google OAuth is configured */
    fastify.get('/oauth/google/status', async (_request, reply) => {
        const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
        const redirectUri  = process.env.GOOGLE_REDIRECT_URI ?? `${getBaseUrl()}/oauth/google/callback`;
        return reply.code(200).send({ configured, redirectUri });
    });

    /** Redirect browser to Google consent page */
    fastify.get('/oauth/google/authorize', async (_request, reply) => {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            const msg = encodeURIComponent(
                'Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file.'
            );
            const frontendBase = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
            return reply.redirect(`${frontendBase}?oauth_error=${msg}`);
        }
        const url = googleAuth.getAuthUrl();
        return reply.redirect(url);
    });

    /** Google redirects here after the user approves */
    fastify.get<{ Querystring: { code?: string; error?: string } }>(
        '/oauth/google/callback',
        async (request, reply) => {
            const { code, error } = request.query;
            const frontendBase = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

            if (error || !code) {
                return reply.redirect(`${frontendBase}?oauth_error=${encodeURIComponent(error ?? 'missing_code')}`);
            }

            try {
                const { email, accessToken, refreshToken, expiryDate } =
                    await googleAuth.exchangeCode(code);

                // Upsert: if this email is already connected, update its tokens
                const existing = await credentialRepo.findAll();
                const match = existing.find((c) => c.email === email && c.provider === 'google');

                if (match) {
                    await credentialRepo.updateTokens(match.id, { accessToken, refreshToken, expiryDate });
                } else {
                    await credentialRepo.create({
                        provider:     'google',
                        label:        email,   // default label = email; user can rename later
                        email,
                        accessToken,
                        refreshToken,
                        expiryDate,
                        scopes: [],
                    });
                }

                return reply.redirect(`${frontendBase}?oauth_success=google`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'oauth_error';
                fastify.log.error(err, 'Google OAuth callback failed');
                return reply.redirect(`${frontendBase}?oauth_error=${encodeURIComponent(msg)}`);
            }
        }
    );

    // ── Slack OAuth ────────────────────────────────────────────────────────────

    /** Check whether Slack OAuth is configured */
    fastify.get('/oauth/slack/status', async (_request, reply) => {
        const configured = slackAuth.isConfigured();
        const redirectUri = process.env.SLACK_REDIRECT_URI ?? `${getBaseUrl()}/oauth/slack/callback`;
        return reply.code(200).send({ configured, redirectUri });
    });

    /** Redirect browser to Slack consent page */
    fastify.get('/oauth/slack/authorize', async (_request, reply) => {
        if (!slackAuth.isConfigured()) {
            const msg = encodeURIComponent(
                'Slack OAuth is not configured. Add SLACK_CLIENT_ID and SLACK_CLIENT_SECRET to your .env file.'
            );
            const frontendBase = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
            return reply.redirect(`${frontendBase}?oauth_error=${msg}`);
        }
        const url = slackAuth.getAuthorizationUrl();
        return reply.redirect(url);
    });

    /** Slack redirects here after the user approves */
    fastify.get<{ Querystring: { code?: string; error?: string } }>(
        '/oauth/slack/callback',
        async (request, reply) => {
            const { code, error } = request.query;
            const frontendBase = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

            if (error || !code) {
                return reply.redirect(`${frontendBase}?oauth_error=${encodeURIComponent(error ?? 'missing_code')}`);
            }

            try {
                await slackAuth.handleCallback(code);
                return reply.redirect(`${frontendBase}?oauth_success=slack`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'oauth_error';
                fastify.log.error(err, 'Slack OAuth callback failed');
                return reply.redirect(`${frontendBase}?oauth_error=${encodeURIComponent(msg)}`);
            }
        }
    );

    // ── Microsoft Teams OAuth ──────────────────────────────────────────────────

    /** Check whether Teams OAuth is configured */
    fastify.get('/oauth/teams/status', async (_request, reply) => {
        const configured  = teamsAuth.isConfigured();
        const redirectUri = process.env.TEAMS_REDIRECT_URI ?? `${getBaseUrl()}/api/oauth/teams/callback`;
        return reply.code(200).send({ configured, redirectUri });
    });

    /** Redirect browser to Microsoft consent page */
    fastify.get('/oauth/teams/authorize', async (_request, reply) => {
        if (!teamsAuth.isConfigured()) {
            const msg = encodeURIComponent(
                'Teams OAuth is not configured. Add TEAMS_CLIENT_ID and TEAMS_CLIENT_SECRET to your .env file.'
            );
            const frontendBase = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
            return reply.redirect(`${frontendBase}?oauth_error=${msg}`);
        }
        const url = teamsAuth.getAuthorizationUrl();
        return reply.redirect(url);
    });

    /** Microsoft redirects here after the user approves */
    fastify.get<{ Querystring: { code?: string; error?: string; error_description?: string } }>(
        '/oauth/teams/callback',
        async (request, reply) => {
            const { code, error, error_description } = request.query;
            const frontendBase = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

            if (error || !code) {
                const msg = error_description ?? error ?? 'missing_code';
                return reply.redirect(`${frontendBase}?oauth_error=${encodeURIComponent(msg)}`);
            }

            try {
                await teamsAuth.handleCallback(code);
                return reply.redirect(`${frontendBase}?oauth_success=teams`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'oauth_error';
                fastify.log.error(err, 'Teams OAuth callback failed');
                return reply.redirect(`${frontendBase}?oauth_error=${encodeURIComponent(msg)}`);
            }
        }
    );
}
