import { eventBus, createLogger, AlertSeverity, AlertStatus } from '@fangops/core';
import { nanoid } from 'nanoid';

const log = createLogger({ component: 'pipeline.airflow', handName: 'pipeline' });

export class AirflowAdapter {
    public readonly apiUrl: string;

    constructor(config: { apiUrl: string }) {
        this.apiUrl = config.apiUrl;
    }

    /**
     * Process a webhook payload from Airflow indicating a DAG run failed
     */
    public async processWebhook(payload: any) {
        log.info({ payload }, 'Received Airflow webhook payload');

        try {
            const dagId = payload.dag_id;
            const runId = payload.run_id;
            const failedTaskId = payload.failed_task_id || 'unknown_task';

            // Fetch logs for the failed task
            const logs = await this.fetchTaskLogs(dagId, runId, failedTaskId);

            // Truncate logs if they are too large
            const maxLogLength = 2000;
            const truncatedLogs = logs.length > maxLogLength
                ? logs.substring(logs.length - maxLogLength) + '\n...[TRUNCATED]'
                : logs;

            // Emit an alert to the event bus
            this.emitAlert({
                dagId,
                runId,
                failedTaskId,
                logs: truncatedLogs,
                state: payload.state
            });

        } catch (error) {
            log.error({ err: error }, 'Failed to process Airflow webhook');
        }
    }

    /**
     * Simulated API Call to Airflow to get task logs
     */
    private async fetchTaskLogs(dagId: string, runId: string, taskId: string): Promise<string> {
        log.debug(`Fetching logs for DAG: ${dagId}, Task: ${taskId}, Run: ${runId}`);
        // Instead of a real HTTP call, we'll return a simulated log string
        return `[2023-10-27 10:00:00,000] {taskinstance.py:1150} INFO - Dependencies all met for <TaskInstance: ${dagId}.${taskId} ${runId} [queued]>
[2023-10-27 10:00:00,500] {taskinstance.py:1150} INFO - Starting attempt 1 of 1
[2023-10-27 10:00:01,000] {taskinstance.py:1150} ERROR - Task failed with exception
Traceback (most recent call last):
  File "task.py", line 42, in execute
    raise Exception("Connection timeout to Data Warehouse")
Exception: Connection timeout to Data Warehouse`;
    }

    private emitAlert(data: { dagId: string; runId: string; failedTaskId: string; logs: string; state: string }) {
        const title = `Airflow DAG Failed: ${data.dagId}`;
        const defaultDescription = `Task ${data.failedTaskId} failed in run ${data.runId}.\n\nLogs:\n${data.logs}`;

        eventBus.emit('alert.received', {
            id: nanoid(),
            source: {
                type: 'custom',
                name: 'airflow',
                sourceId: `${data.dagId}-${data.runId}-${data.failedTaskId}`
            },
            severity: AlertSeverity.HIGH,
            status: AlertStatus.FIRING,
            title,
            description: defaultDescription,
            labels: {
                dagId: data.dagId,
                runId: data.runId,
                taskId: data.failedTaskId,
                pipeline_type: 'airflow',
                // Explicitly send dbtModel as well just in case, though dagId works for pipeline routes map
            },
            annotations: {
                logs: data.logs
            },
            startsAt: new Date(),
            fingerprint: `airflow-${data.dagId}-${data.failedTaskId}`,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        log.info(`Dispatched alert for Airflow DAG ${data.dagId}`);
    }
}
