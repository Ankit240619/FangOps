import { EventBus, RemediationTier, createLogger } from '@fangops/core';
import type { Incident, RemediationAction } from '@fangops/core';
import { nanoid } from 'nanoid';
import { RunbookDatabase } from '../runbooks/index.js';
import type { ExecutionAdapter } from '../execution/index.js';

const log = createLogger({ component: 'ResolverEngine' });

export class RemediationEngine {
    private db: RunbookDatabase;
    private adapters: Map<string, ExecutionAdapter>;
    private globalTier: RemediationTier;
    private eventBus: EventBus;

    constructor(
        eventBus: EventBus,
        globalTier: RemediationTier,
        adapters: ExecutionAdapter[]
    ) {
        this.eventBus = eventBus;
        this.globalTier = globalTier;
        this.db = new RunbookDatabase();

        this.adapters = new Map();
        for (const adapter of adapters) {
            this.adapters.set(adapter.name, adapter);
        }
    }

    /**
     * Start listening to incident creation events.
     */
    start() {
        this.eventBus.on('incident.created', this.handleIncidentCreated.bind(this));
        // We also listen to updates in case root causes are added later by the Analyst
        this.eventBus.on('incident.updated', this.handleIncidentUpdated.bind(this));

        log.info('Remediation Engine started. Listening for incidents.');
    }

    private async handleIncidentCreated(incident: Incident) {
        log.info(`Evaluating incident for remediation: ${incident.id} - ${incident.title}`);
        await this.evaluateIncident(incident);
    }

    private async handleIncidentUpdated(incident: Incident) {
        // Only evaluate if it's still open and we haven't already remediated
        // In a full implementation, we'd check if a remediation was already proposed/executed
        if (incident.status === 'open' || incident.status === 'investigating') {
            await this.evaluateIncident(incident);
        }
    }

    private async evaluateIncident(incident: Incident) {
        // 1. Query the runbook DB
        const matchResult = await this.db.matchIncident(incident);

        if (!matchResult.matched || !matchResult.step) {
            log.debug(`No runbook match found for incident ${incident.id}`);
            // We could emit a failure, but it's cleaner to just do nothing if no runbook exists.
            return;
        }

        const step = matchResult.step;
        log.info(`Matched runbook: ${step.title} for incident ${incident.id}`);

        // 2. Resolve the effective remediation tier. 
        // We use the strictest between the Global Hand setting and the Runbook Step setting
        const effectiveTier = this.resolveEffectiveTier(step.tier, this.globalTier);

        const action: RemediationAction = {
            id: nanoid(),
            incidentId: incident.id,
            tier: effectiveTier,
            action: step.command,
            description: `Auto-matched runbook: ${step.title}`,
            status: 'proposed',
            proposedAt: new Date()
        };

        // 3. Execute according to Tier logic
        if (effectiveTier === RemediationTier.OBSERVE) {
            log.info(`Tier is OBSERVE. Proposing action but not executing.`);
            this.eventBus.emit('remediation.proposed', action);
        } else if (effectiveTier === RemediationTier.SAFE || effectiveTier === RemediationTier.AUTONOMOUS) {
            log.info(`Tier allows execution. Executing immediately.`);
            await this.executeAction(action, step.adapter, step.params);
        } else if (effectiveTier === RemediationTier.APPROVAL) {
            log.info(`Tier is APPROVAL. Proposing action and waiting for human.`);
            this.eventBus.emit('remediation.proposed', action);
            // The execution is paused here. An API endpoint would accept an approval
            // and then call engine.resumeExecution(action.id);
        }
    }

    /**
     * Resumes an execution after human approval.
     */
    async resumeExecution(actionId: string, approvedBy: string, originalIncident: Incident) {
        log.info(`Resuming execution for action ${actionId} approved by ${approvedBy}`);

        // In reality, we'd load the action from a DB, but we'll mock the step lookup again
        const matchResult = await this.db.matchIncident(originalIncident);
        if (matchResult.matched && matchResult.step) {
            const step = matchResult.step;
            const action: RemediationAction = {
                id: actionId,
                incidentId: originalIncident.id,
                tier: step.tier, // or global, keeping it simple
                action: step.command,
                description: step.title,
                status: 'executing',
                approvedBy,
                proposedAt: new Date(), // Mocked
                executedAt: new Date(),
            };

            this.eventBus.emit('remediation.approved', action);
            await this.executeAction(action, step.adapter, step.params);
        }
    }

    private async executeAction(action: RemediationAction, adapterName: string, params: Record<string, unknown>) {
        action.status = 'executing';
        action.executedAt = new Date();
        this.eventBus.emit('remediation.executed', action);

        const adapter = this.adapters.get(adapterName);
        if (!adapter) {
            log.error(`Adapter not found: ${adapterName}`);
            action.status = 'failed';
            action.completedAt = new Date();
            action.result = `Adapter not found: ${adapterName}`;
            this.eventBus.emit('remediation.failed', action);
            return;
        }

        log.info(`Executing via ${adapterName}: ${action.action}`);
        const result = await adapter.execute(action.action, params);

        action.completedAt = new Date();
        if (result.success) {
            action.status = 'completed';
            action.result = result.output;
            action.rollbackCommand = result.rollbackCommand;
            this.eventBus.emit('remediation.executed', action);
            log.info(`Execution completed successfully: ${result.output}`);
        } else {
            action.status = 'failed';
            action.result = result.error;
            this.eventBus.emit('remediation.failed', action);
            log.error(`Execution failed: ${result.error}`);
        }
    }

    /**
     * Resolves the strictest tier between the global setting and runbook step
     */
    private resolveEffectiveTier(stepTier: RemediationTier, globalTier: RemediationTier): RemediationTier {
        const tierWeights = {
            [RemediationTier.OBSERVE]: 1,
            [RemediationTier.APPROVAL]: 2,
            [RemediationTier.SAFE]: 3,
            [RemediationTier.AUTONOMOUS]: 4,
        };

        const stepWeight = tierWeights[stepTier];
        const globalWeight = tierWeights[globalTier];

        // The lower weight is safer (stricter)
        if (stepWeight <= globalWeight) {
            return stepTier;
        }
        return globalTier;
    }
}
