import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '@fangops/core';
import { AirflowAdapter } from '../src/integrations/airflow/index.js';
import { SchemaDriftDetector } from '../src/drift/index.js';

describe('Pipeline Hand Components', () => {
    beforeEach(() => {
        // Clear all listeners on the global instance
        eventBus.removeAllListeners();
        vi.clearAllMocks();
    });

    it('AirflowAdapter should process webhooks and emit alerts', async () => {
        const adapter = new AirflowAdapter({ apiUrl: 'http://test' });

        const emitSpy = vi.spyOn(eventBus, 'emit');

        await adapter.processWebhook({
            dag_id: 'test_dag',
            run_id: 'run_123',
            failed_task_id: 'failing_node',
            state: 'failed'
        });

        expect(emitSpy).toHaveBeenCalledWith('alert.received', expect.objectContaining({
            severity: 'high',
            title: 'Airflow DAG Failed: test_dag'
        }));
    });

    it('SchemaDriftDetector should detect dropped columns', async () => {
        const detector = new SchemaDriftDetector({ targetDb: 'test' });
        const emitSpy = vi.spyOn(eventBus, 'emit');

        await detector.checkSchemaDrift();
        expect(emitSpy).not.toHaveBeenCalled();
    });
});
