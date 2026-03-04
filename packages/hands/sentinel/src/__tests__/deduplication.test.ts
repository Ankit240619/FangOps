import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebhookReceiver } from '../ingestion/webhook-receiver.js';
import { EventBus } from '@fangops/core';
import type { Alert } from '@fangops/core';

describe('WebhookReceiver Normalization & Deduplication', () => {
    let receiver: WebhookReceiver;
    let eventBus: EventBus;
    let emittedAlerts: Alert[] = [];

    beforeEach(() => {
        eventBus = EventBus.getInstance();
        eventBus.on('alert.received', (alert) => {
            if (alert) emittedAlerts.push(alert as Alert);
        });
        receiver = new WebhookReceiver();
        receiver.start();
        emittedAlerts = [];
    });

    afterEach(() => {
        receiver.stop();
        eventBus.removeAllListeners();
        EventBus.resetInstance();
    });

    it('should normalize and emit a generic webhook', () => {
        const payload = {
            title: 'Test Webhook',
            message: 'This is a test generic webhook',
            status: 'firing'
        };

        eventBus.emit('webhook.received', payload);

        expect(emittedAlerts.length).toBe(1);
        expect(emittedAlerts[0]?.title).toBe('Test Webhook');
        expect(emittedAlerts[0]?.source.type).toBe('webhook');
        expect(emittedAlerts[0]?.status).toBe('firing');
    });

    it('should deduplicate identical concurrent webhooks', () => {
        const payload = {
            title: 'Repeated Webhook',
            status: 'firing'
        };

        // Emit it 3 times quickly
        eventBus.emit('webhook.received', payload);
        eventBus.emit('webhook.received', payload);
        eventBus.emit('webhook.received', payload);

        // Receiver should deduplicate
        expect(emittedAlerts.length).toBe(1);
    });

    it('should pass through if status changes', () => {
        const payload1 = { title: 'State Change Alert', status: 'firing' };
        const payload2 = { title: 'State Change Alert', status: 'resolved' };

        eventBus.emit('webhook.received', payload1);
        eventBus.emit('webhook.received', payload2);

        expect(emittedAlerts.length).toBe(2);
        expect(emittedAlerts[0]?.status).toBe('firing');
        expect(emittedAlerts[1]?.status).toBe('resolved');
    });

    it('should normalize a Prometheus Alertmanager payload', () => {
        const payload = {
            alerts: [
                {
                    status: 'firing',
                    labels: { alertname: 'HighCPU', severity: 'critical' },
                    annotations: { summary: 'CPU is high on node-1' }
                }
            ]
        };

        eventBus.emit('webhook.received', payload);

        expect(emittedAlerts.length).toBe(1);
        expect(emittedAlerts[0]?.title).toBe('CPU is high on node-1');
        expect(emittedAlerts[0]?.severity).toBe('critical');
    });
});
