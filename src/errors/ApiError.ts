export interface ApiErrorResponse {
    statusCode: number;
    error: string;
    message: string;
    requestId: string;
    timestamp: string;
    details?: unknown;
}

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public error: string,
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export const NotFoundError = (resource: string) =>
    new ApiError(404, 'Not Found', `${resource} not found`);

export const BadRequestError = (message: string, details?: unknown) =>
    new ApiError(400, 'Bad Request', message, details);

export const UnauthorizedError = (message?: string) =>
    new ApiError(401, 'Unauthorized', message ?? 'Missing API key. Provide it via x-api-key header.');

export const ForbiddenError = (message?: string) =>
    new ApiError(403, 'Forbidden', message ?? 'Invalid API key.');