import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AlertCorrelationEngine } from '../correlation/correlation-engine.js';
import { AlertSeverity, AlertStatus, EventBus } from '@fangops/core';
import type { Alert, CorrelatedAlertGroup } from '@fangops/core';

describe('AlertCorrelationEngine', () => {
    let engine: AlertCorrelationEngine;
    let eventBus: EventBus;
    let emittedEvents: CorrelatedAlertGroup[] = [];

    beforeEach(() => {
        eventBus = EventBus.getInstance();
        eventBus.on('alert.correlated', (group) => {
            if (group) emittedEvents.push(group as CorrelatedAlertGroup);
        });
        engine = new AlertCorrelationEngine(300, 2, 0.7);
        engine.start();
        emittedEvents = [];
    });

    afterEach(() => {
        engine.stop();
        eventBus.removeAllListeners();
        EventBus.resetInstance();
    });

    const createAlert = (id: string, labels: Record<string, string>, title = 'Test Alert', offsetMs = 0): Alert => ({
        id,
        source: { type: 'prometheus', name: 'prom', sourceId: 'test' },
        severity: AlertSeverity.HIGH,
        status: AlertStatus.FIRING,
        title,
        description: 'Test',
        labels,
        annotations: {},
        startsAt: new Date(),
        fingerprint: `fp-${id}`,
        createdAt: new Date(Date.now() - offsetMs),
        updatedAt: new Date()
    });

    it('should not correlate independent alerts', () => {
        const a1 = createAlert('1', { service: 'web', instance: 'web-1' });
        const a2 = createAlert('2', { service: 'db', instance: 'db-1' });

        eventBus.emit('alert.received', a1);
        eventBus.emit('alert.received', a2);

        engine.runCorrelationSweep();

        expect(emittedEvents.length).toBe(0);
    });

    it('should correlate highly similar alerts', () => {
        const a1 = createAlert('1', { service: 'api', region: 'us-east', instance: 'api-1' });
        const a2 = createAlert('2', { service: 'api', region: 'us-east', instance: 'api-2' }); // 2 out of 3 match = 2/4 union = 0.5? 
        // Oh wait, Jaccard: intersection is {service=api, region=us-east}. 
        // Union is {service=api, region=us-east, instance=api-1, instance=api-2}.
        // intersection(2) / union(4) = 0.5. Default threshold is 0.7. So it won't correlate.

        const a3 = createAlert('3', { app: 'payment', cluster: 'prod-1', env: 'prod' });
        const a4 = createAlert('4', { app: 'payment', cluster: 'prod-1', env: 'prod' });
        // Intersection(3) / union(3) = 1.0. This will correlate.

        eventBus.emit('alert.received', a1);
        eventBus.emit('alert.received', a2);
        eventBus.emit('alert.received', a3);
        eventBus.emit('alert.received', a4);

        engine.runCorrelationSweep();

        expect(emittedEvents.length).toBe(1);
        expect(emittedEvents[0]?.alerts.length).toBe(2);
        expect(emittedEvents[0]?.alerts[0]?.id).toBe('3');
        expect(emittedEvents[0]?.alerts[1]?.id).toBe('4');
    });

    it('should ignore alerts outside the time window', () => {
        const a1 = createAlert('1', { type: 'timeout' }, 'Timeout', 600_000); // 10 mins ago
        const a2 = createAlert('2', { type: 'timeout' }, 'Timeout', 0); // now

        eventBus.emit('alert.received', a1);
        eventBus.emit('alert.received', a2);

        engine.runCorrelationSweep();

        expect(emittedEvents.length).toBe(0);
    });
});
