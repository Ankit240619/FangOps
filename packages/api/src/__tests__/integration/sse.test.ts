import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../index';
import type { FastifyInstance } from 'fastify';

describe('SSE Integration Test', () => {
    let app: FastifyInstance;
    let token: string;
    let port: number;

    beforeAll(async () => {
        app = await buildApp();
        await app.listen({ port: 0, host: '127.0.0.1' });
        port = (app.server.address() as any).port;

        // Get auth token
        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: 'admin@fangops.local', password: 'admin' }
        });
        token = loginResponse.json().data.token;
    });

    afterAll(async () => {
        await app.close();
    });

    it('should establish an SSE connection', async () => {
        const controller = new AbortController();

        const res = await fetch(`http://127.0.0.1:${port}/api/v1/sse/events`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('text/event-stream');

        // Read the first chunk of data
        const reader = res.body!.getReader();
        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);

        expect(text).toContain('event: connected');
        expect(text).toContain('SSE Connection Established');

        // Abort to clean up the persistent connection
        controller.abort();
    });
});
