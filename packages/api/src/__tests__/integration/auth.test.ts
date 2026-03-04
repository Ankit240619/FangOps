import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../index';
import type { FastifyInstance } from 'fastify';

describe('Auth Integration Tests', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should login admin user and return JWT', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: 'admin@fangops.local',
                password: 'admin'
            }
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.success).toBe(true);
        expect(payload.data).toHaveProperty('token');
        expect(payload.data).toHaveProperty('user');
        expect(payload.data.user.email).toBe('admin@fangops.local');
    });

    it('should reject invalid login credentials', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: 'admin@fangops.local',
                password: 'wrongpassword'
            }
        });

        expect(response.statusCode).toBe(401);
    });

    it('should reject access to protected route without token', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me'
        });

        expect(response.statusCode).toBe(401);
    });

    it('should access protected route with valid token', async () => {
        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: 'admin@fangops.local',
                password: 'admin'
            }
        });
        const { token } = loginResponse.json().data;

        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data.email).toBe('admin@fangops.local');
    });
});
