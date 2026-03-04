import { nanoid } from 'nanoid';
import { createLogger, EventBus, AlertSeverity } from '@fangops/core';
import type { Alert, CorrelatedAlertGroup } from '@fangops/core';

export class AlertCorrelationEngine {
    private logger = createLogger({ component: 'correlation-engine', handName: 'sentinel' });
    private eventBus = EventBus.getInstance();

    // Buffer of recent alerts to consider for correlation
    private alertBuffer: Alert[] = [];

    // Track sets of alerts we've already correlated to avoid duplicating correlation groups
    private correlatedFingerprints = new Set<string>();

    constructor(
        private windowSeconds = 300,
        private minAlerts = 2,
        private similarityThreshold = 0.7
    ) { }

    public start(): void {
        this.logger.info(`Starting Correlation Engine (window: ${this.windowSeconds}s, min: ${this.minAlerts}, threshold: ${this.similarityThreshold})`);
        this.eventBus.on('alert.received', this.handleNewAlert.bind(this));

        // Run correlation sweep every 30 seconds
        setInterval(() => this.runCorrelationSweep(), 30_000).unref();

        // Run buffer cleanup every minute
        setInterval(() => this.cleanupBuffer(), 60_000).unref();
    }

    public stop(): void {
        this.logger.info('Stopping Correlation Engine...');
        this.eventBus.off('alert.received', this.handleNewAlert.bind(this));
    }

    private handleNewAlert(alert: Alert): void {
        this.alertBuffer.push(alert);
    }

    /**
     * Periodically runs over the buffer to find highly similar sets of alerts
     */
    public runCorrelationSweep(): void {
        if (this.alertBuffer.length < this.minAlerts) {
            return;
        }

        // 1. We'll greedily cluster alerts
        // For each alert that isn't already part of a correlation, find all similar alerts
        const clustered = new Set<string>();
        const newGroups: CorrelatedAlertGroup[] = [];

        for (let i = 0; i < this.alertBuffer.length; i++) {
            const anchor = this.alertBuffer[i];

            // Skip if this anchor is already clustered in this sweep, 
            // or if we already correlated it in a previous sweep.
            if (!anchor || clustered.has(anchor.id) || this.correlatedFingerprints.has(anchor.fingerprint)) {
                continue;
            }

            const candidateGroup: Alert[] = [anchor];
            clustered.add(anchor.id);

            for (let j = i + 1; j < this.alertBuffer.length; j++) {
                const target = this.alertBuffer[j];

                if (!target || clustered.has(target.id) || this.correlatedFingerprints.has(target.fingerprint)) {
                    continue;
                }

                // Make sure they are within the time window
                const timeDiffMs = Math.abs(anchor.createdAt.getTime() - target.createdAt.getTime());
                if (timeDiffMs > this.windowSeconds * 1000) {
                    continue;
                }

                // Check similarity
                const similarity = this.calculateSimilarity(anchor, target);
                if (similarity >= this.similarityThreshold) {
                    candidateGroup.push(target);
                    clustered.add(target.id);
                }
            }

            // Create group if it meets the minimum threshold
            if (candidateGroup.length >= this.minAlerts) {
                const group = this.createCorrelatedGroup(candidateGroup);
                newGroups.push(group);

                // Mark fingerprints so we don't correlate these exact instances again
                candidateGroup.forEach(a => this.correlatedFingerprints.add(a.fingerprint));
            }
        }

        // 2. Emit new groups
        for (const group of newGroups) {
            this.logger.info(
                { correlationId: group.correlationId, size: group.alerts.length, title: group.title },
                'Created new correlated alert group'
            );
            this.eventBus.emit('alert.correlated', group);
        }
    }

    /**
     * Jaccard similarity between two sets of labels
     */
    private calculateSimilarity(a: Alert, b: Alert): number {
        const labelsA = Object.entries(a.labels || {}).map(([k, v]) => `${k}=${v}`);
        const setA = new Set(labelsA);

        const labelsB = Object.entries(b.labels || {}).map(([k, v]) => `${k}=${v}`);
        const setB = new Set(labelsB);

        // Fast path for empty labels
        if (setA.size === 0 && setB.size === 0) {
            return a.title === b.title ? 1.0 : 0.0; // Fallback to title match
        }

        let intersectionCount = 0;
        for (const item of setA) {
            if (setB.has(item)) {
                intersectionCount++;
            }
        }

        const unionCount = setA.size + setB.size - intersectionCount;
        return unionCount === 0 ? 0 : intersectionCount / unionCount;
    }

    private createCorrelatedGroup(alerts: Alert[]): CorrelatedAlertGroup {
        const correlationId = `cor_${nanoid(16)}`;

        // Link alerts to this group
        alerts.forEach(a => { a.correlationId = correlationId; });

        // Highest severity dictates group severity
        const severities = alerts.map(a => a.severity);
        let groupSeverity = AlertSeverity.INFO;
        if (severities.includes(AlertSeverity.CRITICAL)) groupSeverity = AlertSeverity.CRITICAL;
        else if (severities.includes(AlertSeverity.HIGH)) groupSeverity = AlertSeverity.HIGH;
        else if (severities.includes(AlertSeverity.MEDIUM)) groupSeverity = AlertSeverity.MEDIUM;
        else if (severities.includes(AlertSeverity.LOW)) groupSeverity = AlertSeverity.LOW;

        // Title and summary (can be enhanced by LLM later)
        const title = `Correlated: ${alerts[0]?.title} + ${alerts.length - 1} more`;
        const services = Array.from(new Set(alerts.map(a => a.labels['service'] || a.labels['app'] || 'unknown')));
        const summary = `${alerts.length} similar alerts detected affecting: ${services.join(', ')}`;

        return {
            correlationId,
            alerts,
            severity: groupSeverity,
            title,
            summary,
            createdAt: new Date()
        };
    }

    private cleanupBuffer(): void {
        const now = Date.now();
        const cutoff = now - (this.windowSeconds * 1000 * 2); // keep 2x window sizes to be safe

        const initialSize = this.alertBuffer.length;
        this.alertBuffer = this.alertBuffer.filter(a => a.createdAt.getTime() > cutoff);

        if (initialSize !== this.alertBuffer.length) {
            this.logger.debug(`Correlation buffer cleanup: removed ${initialSize - this.alertBuffer.length} old alerts`);
        }

        // Also clean up correlated fingerprints cache to prevent infinite growth.
        // We only care about recently correlated stuff.
        if (this.correlatedFingerprints.size > 10000) {
            this.correlatedFingerprints.clear();
        }
    }
}
