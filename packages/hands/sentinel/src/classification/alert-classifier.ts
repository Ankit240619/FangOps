import { createLogger, EventBus, AlertSeverity, LLMGateway, LLMProvider } from '@fangops/core';
import type { CorrelatedAlertGroup } from '@fangops/core';

export class LLMAlertClassifier {
    private logger = createLogger({ component: 'alert-classifier', handName: 'sentinel' });
    private eventBus = EventBus.getInstance();

    // Cache responses for completely identical groups (based on a composite fingerprint) 
    // to avoid re-running identical prompts within a short time.
    private responseCache = new Map<string, { severity: AlertSeverity, summary: string, rootCause: string, timestamp: number }>();
    private readonly cacheTtlMs = 15 * 60 * 1000; // 15 mins

    constructor(
        private llmGateway: LLMGateway,
        private model: string,
        private provider: LLMProvider,
        private handId: string
    ) { }

    public start(): void {
        this.logger.info(`Starting LLM Alert Classifier (Model: ${this.model})`);
        this.eventBus.on('alert.correlated', this.handleCorrelatedGroup.bind(this));

        setInterval(() => this.cleanupCache(), 5 * 60 * 1000).unref();
    }

    public stop(): void {
        this.logger.info('Stopping LLM Alert Classifier...');
        this.eventBus.off('alert.correlated', this.handleCorrelatedGroup.bind(this));
    }

    private async handleCorrelatedGroup(group: CorrelatedAlertGroup): Promise<void> {
        try {
            // Generate composite fingerprint
            const compositeFingerprint = group.alerts.map(a => a.fingerprint).sort().join('-');

            const cached = this.responseCache.get(compositeFingerprint);
            if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
                this.logger.debug({ correlationId: group.correlationId }, 'Using cached LLM classification');
                group.severity = cached.severity;
                group.summary = cached.summary;
                group.rootCauseHypothesis = cached.rootCause;

                // Emit event indicating an incident needs to be created, passing the classified group
                this.emitIncidentCreation(group);
                return;
            }

            this.logger.info({ correlationId: group.correlationId }, 'Calling LLM for alert classification');

            const prompt = this.buildPrompt(group);

            const response = await this.llmGateway.complete({
                provider: this.provider,
                model: this.model,
                messages: [
                    { role: 'system', content: 'You are an expert SRE / DevOps engineer summarizing monitoring alerts. Be concise, direct, and actionable.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1, // Low temp for consistency
                maxTokens: 500,
                handId: this.handId
            });

            // Parse response
            const content = response.content.trim();
            const parsed = this.parseResponse(content);

            // Update group with LLM insights
            if (parsed.severity) group.severity = parsed.severity;
            if (parsed.summary) group.summary = parsed.summary;
            if (parsed.rootCause) group.rootCauseHypothesis = parsed.rootCause;

            // Cache it
            this.responseCache.set(compositeFingerprint, {
                severity: group.severity,
                summary: group.summary,
                rootCause: group.rootCauseHypothesis || '',
                timestamp: Date.now()
            });

            // Emit incident creation event for Reporter/API
            this.emitIncidentCreation(group);

        } catch (error) {
            this.logger.error({ err: error, correlationId: group.correlationId }, 'Failed to classify alerts with LLM');
            // Even if LLM fails, we should still emit the incident creation event 
            // with the basic heuristical values computed by the correlation engine.
            this.emitIncidentCreation(group);
        }
    }

    private emitIncidentCreation(group: CorrelatedAlertGroup): void {
        // We emit 'incident.created' from Sentinel to let the Reporter or API know.
        // Usually, an actual Incident object is formed, but for now we dispatch the group
        // and let the core/API handle the state. In Fangops, Sentinel creates the incident.
        this.eventBus.emit('incident.created', {
            id: `inc_${group.correlationId.split('_')[1]}`,
            title: group.summary || group.title,
            description: group.rootCauseHypothesis || 'No detailed analysis available.',
            severity: group.severity,
            status: 'open' as any, // IncidentStatus.OPEN
            correlatedGroups: [group.correlationId],
            timeline: [{
                timestamp: new Date(),
                type: 'alert',
                actor: 'sentinel',
                message: 'Incident automatically created from correlated alerts'
            }],
            remediationActions: [],
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    private buildPrompt(group: CorrelatedAlertGroup): string {
        const alertList = group.alerts.map(a =>
            `- Title: ${a.title}\n  Severity: ${a.severity}\n  Source: ${a.source.type}/${a.source.sourceId}\n  Description: ${a.description}\n  Labels: ${JSON.stringify(a.labels)}`
        ).join('\n\n');

        return `
Analyze the following correlated group of ${group.alerts.length} alerts.
Determine the combined true severity of this incident, summarize what is actually failing, and hypothesize a root cause.

ALERTS:
${alertList}

Format your response EXACTLY as follows:
SEVERITY: [critical|high|medium|low|info]
SUMMARY: [1-2 sentences summarizing the actual business or technical impact]
ROOT_CAUSE: [2-3 sentences explaining what is likely causing this based on the labels and descriptions]
        `.trim();
    }

    private parseResponse(content: string): { severity?: AlertSeverity, summary?: string, rootCause?: string } {
        const result: any = {};

        const severityMatch = content.match(/SEVERITY:\s*([a-zA-Z]+)/i);
        if (severityMatch && severityMatch[1]) {
            const rawSev = severityMatch[1].toLowerCase();
            if (['critical', 'high', 'medium', 'low', 'info'].includes(rawSev)) {
                result.severity = rawSev as AlertSeverity;
            }
        }

        const summaryMatch = content.match(/SUMMARY:\s*(.+?)(?=\nROOT_CAUSE:|$)/is);
        if (summaryMatch && summaryMatch[1]) {
            result.summary = summaryMatch[1].trim();
        }

        const rootCauseMatch = content.match(/ROOT_CAUSE:\s*(.+)/is);
        if (rootCauseMatch && rootCauseMatch[1]) {
            result.rootCause = rootCauseMatch[1].trim();
        }

        return result;
    }

    private cleanupCache(): void {
        const now = Date.now();
        let evictions = 0;
        for (const [key, value] of this.responseCache.entries()) {
            if (now - value.timestamp > this.cacheTtlMs) {
                this.responseCache.delete(key);
                evictions++;
            }
        }
        if (evictions > 0) {
            this.logger.debug({ evictions, size: this.responseCache.size }, 'Cleared LLM response cache');
        }
    }
}
