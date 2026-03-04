import {
    BaseHand,
    type HandConfig,
    RemediationTier,
    createLogger
} from '@fangops/core';

import { SSHAdapter, KubernetesAdapter } from './execution/index.js';
import { RemediationEngine } from './engine/index.js';

const log = createLogger({ component: 'ResolverHand' });

export class ResolverHand extends BaseHand {
    private engine: RemediationEngine | undefined;

    constructor(config: HandConfig) {
        super(config);
    }

    protected async onInit(): Promise<void> {
        log.info('Initializing Resolver Hand...');

        // Initialize adapters
        const sshAdapter = new SSHAdapter();
        const k8sAdapter = new KubernetesAdapter();

        // Determine global remediation tier from config
        const globalTier = this.config.remediationTier || RemediationTier.OBSERVE;

        // Initialize remediation engine
        this.engine = new RemediationEngine(
            this.eventBus,
            globalTier,
            [sshAdapter, k8sAdapter]
        );

        log.info(`Resolver Hand initialized with global safety tier: ${globalTier}`);
    }

    protected async onExecute(): Promise<void> {
        if (!this.engine) {
            throw new Error('Resolver Hand not initialized');
        }

        this.engine.start();

        log.info('Resolver Hand started executing successfully.');
    }

    protected async onShutdown(): Promise<void> {
        log.info('Resolver Hand shutting down...');
        // Clean up connections if necessary
    }

    /**
     * Exposes a method to resume an action after external approval.
     * This would typically be called by an API route `/api/remediation/:id/approve`.
     */
    async resumeAction(actionId: string, approvedBy: string, originalIncident: any): Promise<boolean> {
        if (!this.engine) {
            log.error('Cannot resume action: Remediation Engine not initialized.');
            return false;
        }

        try {
            await this.engine.resumeExecution(actionId, approvedBy, originalIncident);
            return true;
        } catch (error) {
            log.error({ err: error }, `Failed to resume execution for action ${actionId}`);
            return false;
        }
    }
}

// Export everything for consumers
export * from './execution/index.js';
export * from './runbooks/index.js';
export * from './engine/index.js';
