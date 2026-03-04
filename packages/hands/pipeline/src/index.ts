import { BaseHand, createLogger, eventBus, type HandConfig } from '@fangops/core';
import { AirflowAdapter } from './integrations/airflow/index.js';
import { DbtAdapter } from './integrations/dbt/index.js';
import { SchemaDriftDetector } from './drift/index.js';

const log = createLogger({ component: 'pipeline.hand', handName: 'pipeline' });

export class PipelineHand extends BaseHand {
    private airflow: AirflowAdapter;
    private dbt: DbtAdapter;
    private drift: SchemaDriftDetector;

    constructor(config: HandConfig) {
        super(config);

        // Initialize components with config settings (or fallbacks)
        const airflowUrl = (config.settings.airflow as any)?.api_url || 'http://localhost:8080/api/v1';
        this.airflow = new AirflowAdapter({ apiUrl: airflowUrl });

        const dbtResultsPath = (config.settings.dbt as any)?.run_results_path || './target/run_results.json';
        this.dbt = new DbtAdapter({ runResultsPath: dbtResultsPath });

        const targetDb = (config.settings.drift as any)?.target_db || 'postgresql://user:pass@localhost:5432/db';
        this.drift = new SchemaDriftDetector({ targetDb });
    }

    /**
     * Called when the Hand is initialized.
     */
    protected async onInit(): Promise<void> {
        log.info('PipelineHand starting up...');

        // Subscribe to external webhook payloads that might come via the API server
        // e.g. Airflow calling /api/v1/alerts/webhook
        eventBus.on('webhook.received', this.handleWebhook.bind(this));

        log.info('PipelineHand initialized successfully.');
    }

    /**
     * Executes periodically based on config schedule
     */
    protected async onExecute(): Promise<void> {
        log.debug('Running periodic Pipeline checks...');

        // Check for newly failed dbt tests
        await this.dbt.checkRunResults();

        // Check for underlying schema changes
        await this.drift.checkSchemaDrift();
    }

    /**
     * Called when the Hand is stopped.
     */
    protected async onShutdown(): Promise<void> {
        log.info('PipelineHand shutting down...');
        eventBus.off('webhook.received', this.handleWebhook.bind(this));
    }

    /**
     * Handle incoming webhooks mapped to Pipeline tool integrations
     */
    private async handleWebhook(payload: any) {
        // Simple heuristic to route webhooks
        if (payload?.source === 'airflow' || payload?.dag_id) {
            await this.airflow.processWebhook(payload);
        }
    }
}

// Export a factory function so FangOps can instantiate it
export default function createPipelineHand(config: HandConfig): PipelineHand {
    return new PipelineHand(config);
}
