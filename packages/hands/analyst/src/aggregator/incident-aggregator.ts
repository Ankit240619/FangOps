import { createLogger, type Incident } from '@fangops/core';

export class IncidentAggregator {
    private logger;

    constructor() {
        this.logger = createLogger({ component: 'analyst:aggregator' });
    }

    /**
     * Aggregates full timeline and context for a resolved incident.
     * In a real implementation with a DB, this would query the DB for alerts,
     * timelines, and actions. For now, it returns the incident itself as context.
     */
    public async aggregateContext(incident: Incident): Promise<string> {
        this.logger.info(`Aggregating timeline for incident ${incident.id}`);

        // Construct a text-based representation of the incident timeline
        const contextLines: string[] = [];
        contextLines.push(`Incident: ${incident.title} (${incident.id})`);
        contextLines.push(`Severity: ${incident.severity}`);
        if (incident.description) contextLines.push(`Description: ${incident.description}`);

        contextLines.push('\n--- Timeline ---');
        for (const entry of incident.timeline) {
            contextLines.push(`[${new Date(entry.timestamp).toISOString()}] ${entry.type} by ${entry.actor}: ${entry.message}`);
        }

        contextLines.push('\n--- Remediation Actions ---');
        if (incident.remediationActions.length > 0) {
            for (const action of incident.remediationActions) {
                contextLines.push(`- Action: ${action.action} (${action.status}) - ${action.description}`);
                if (action.result) contextLines.push(`  Result: ${action.result}`);
            }
        } else {
            contextLines.push('No remediation actions recorded.');
        }

        return contextLines.join('\n');
    }
}
