import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../index';
import { eventBus } from '@fangops/core';
import type { FastifyInstance } from 'fastify';

describe('Sentinel Webhook Integration Test', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should receive a webhook and publish an alert event to EventBus', async () => {
        return new Promise<void>(async (resolve, reject) => {
            const testPayload = { test: true, message: 'Test alert' };

            // Listen for the event that the webhook should emit
            eventBus.once('webhook.received', (payload) => {
                try {
                    expect(payload).toEqual(testPayload);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/alerts/webhook',
                payload: testPayload
            });

            expect(response.statusCode).toBe(202);
            expect(response.json().success).toBe(true);
        });
    });
});
