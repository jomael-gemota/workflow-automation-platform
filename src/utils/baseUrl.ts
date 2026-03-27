/**
 * Returns the public base URL of this service.
 *
 * - Production (Railway): uses RAILWAY_PUBLIC_DOMAIN which Railway injects automatically.
 * - Development: falls back to http://localhost:{PORT}.
 *
 * Explicit APP_URL overrides both (useful for custom domains or other platforms).
 */
export function getBaseUrl(): string {
    if (process.env.APP_URL) {
        return process.env.APP_URL.replace(/\/$/, '');
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }
    const port = process.env.PORT ?? '3000';
    return `http://localhost:${port}`;
}
