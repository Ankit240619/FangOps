import { eventBus, createLogger, AlertSeverity, AlertStatus } from '@fangops/core';
import { nanoid } from 'nanoid';
import fs from 'node:fs/promises';

const log = createLogger({ component: 'pipeline.dbt', handName: 'pipeline' });

export class DbtAdapter {
    private runResultsPath: string;

    constructor(config: { runResultsPath: string }) {
        this.runResultsPath = config.runResultsPath;
    }

    /**
     * Parse local run_results.json to find dbt test failures
     */
    public async checkRunResults() {
        log.info(`Checking dbt run results at ${this.runResultsPath}`);

        try {
            const fileData = await fs.readFile(this.runResultsPath, 'utf-8');
            const runResults = JSON.parse(fileData);

            if (!runResults || !runResults.results) {
                log.warn('Invalid dbt run_results.json format');
                return;
            }

            const failures = runResults.results.filter((res: any) => res.status === 'fail' || res.status === 'error');

            if (failures.length > 0) {
                log.info(`Found ${failures.length} dbt test failures`);
                for (const failure of failures) {
                    this.emitAlert(failure);
                }
            } else {
                log.info('No dbt test failures found');
            }

        } catch (error: any) {
            if (error.code === 'ENOENT') {
                log.debug(`dbt run_results.json not found at ${this.runResultsPath} (this is normal if dbt hasn't run yet)`);
            } else {
                log.error({ err: error }, 'Failed to parse dbt run results');
            }
        }
    }

    private emitAlert(failureResult: any) {
        const testNodeId = failureResult.unique_id || 'unknown_test';
        // e.g. "test.my_project.not_null_my_model_id" -> "my_model"
        const modelNameParts = testNodeId.split('.');
        const modelName = modelNameParts.length > 2 ? modelNameParts[2] : 'unknown_model';
        const message = failureResult.message || 'dbt data quality test failed';

        const title = `dbt Test Failure: ${modelName}`;
        const description = `Data quality test failed for node ${testNodeId}.\n\nError Message:\n${message}`;

        eventBus.emit('alert.received', {
            id: nanoid(),
            source: {
                type: 'custom',
                name: 'dbt',
                sourceId: testNodeId
            },
            severity: AlertSeverity.CRITICAL, // DQ issues are typically critical for pipelines
            status: AlertStatus.FIRING,
            title,
            description,
            labels: {
                dbtModel: modelName,
                testId: testNodeId,
                pipeline_type: 'dbt',
            },
            annotations: {
                message
            },
            startsAt: new Date(),
            fingerprint: `dbt-${testNodeId}`,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        log.info(`Dispatched alert for dbt test ${testNodeId}`);
    }
}
