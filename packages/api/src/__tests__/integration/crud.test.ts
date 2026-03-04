import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../index';
import type { FastifyInstance } from 'fastify';

describe('CRUD Integration Tests', () => {
    let app: FastifyInstance;
    let token: string;

    beforeAll(async () => {
        app = await buildApp();

        // Get auth token
        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: 'admin@fangops.local', password: 'admin' }
        });
        if (loginResponse.statusCode !== 200) {
            throw new Error(`Login failed in beforeAll: ${loginResponse.payload}`);
        }
        token = loginResponse.json().data.token;
    });

    afterAll(async () => {
        await app.close();
    });

    it('should fetch alerts list', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/alerts',
            headers: { Authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.meta).toHaveProperty('total');
    });

    it('should fetch alert stats', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/alerts/stats',
            headers: { Authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveProperty('total');
    });
});
