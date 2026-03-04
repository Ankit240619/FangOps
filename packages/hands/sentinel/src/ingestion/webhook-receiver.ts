import { nanoid } from 'nanoid';
import { createLogger, EventBus, AlertSeverity, AlertStatus } from '@fangops/core';
import type { Alert } from '@fangops/core';
import crypto from 'crypto';

export class WebhookReceiver {
    private logger = createLogger({ component: 'webhook-receiver', handName: 'sentinel' });
    private eventBus = EventBus.getInstance();

    // Simple deduplication cache: fingerprint -> Object containing status and timestamp
    private deduplicationCache = new Map<string, { status: AlertStatus; timestamp: number }>();
    private readonly cacheTtlMs = 60 * 60 * 1000; // 1 hour

    constructor() { }

    public start(): void {
        this.logger.info('Starting Webhook Receiver: listening for webhook.received events...');
        this.eventBus.on('webhook.received', this.handleWebhookPayload.bind(this));

        // Clean up cache periodically
        setInterval(() => this.cleanupCache(), 5 * 60 * 1000).unref();
    }

    public stop(): void {
        this.logger.info('Stopping Webhook Receiver...');
        this.eventBus.off('webhook.received', this.handleWebhookPayload.bind(this));
    }

    private handleWebhookPayload(payload: unknown): void {
        try {
            const alerts = this.normalize(payload);

            for (const alert of alerts) {
                if (this.isDuplicate(alert)) {
                    this.logger.debug({ fingerprint: alert.fingerprint }, 'Dropping duplicate alert to prevent noise');
                    continue;
                }

                // Track for deduplication
                this.deduplicationCache.set(alert.fingerprint, {
                    status: alert.status,
                    timestamp: Date.now()
                });

                // Emit normalized alert
                this.logger.info({ alertId: alert.id, title: alert.title }, 'Normalized new alert received');
                this.eventBus.emit('alert.received', alert);
            }
        } catch (error) {
            this.logger.error({ err: error, payload }, 'Failed to process webhook payload');
        }
    }

    private normalize(payload: any): Alert[] {
        if (!payload || typeof payload !== 'object') {
            return [];
        }

        // 1. Prometheus Alertmanager Format
        if (Array.isArray(payload.alerts)) {
            return payload.alerts.map((a: any) => this.normalizePrometheusAlert(a));
        }

        // 2. Grafana Legacy / Simple Webhook Format
        if (payload.state && payload.ruleName) {
            return [this.normalizeGrafanaAlert(payload)];
        }

        // 3. Generic JSON Fallback
        return [this.normalizeGenericAlert(payload)];
    }

    private normalizePrometheusAlert(raw: any): Alert {
        const title = raw.annotations?.summary || raw.labels?.alertname || 'Prometheus Alert';
        const description = raw.annotations?.description || 'No description provided';
        const status = raw.status === 'resolved' ? AlertStatus.RESOLVED : AlertStatus.FIRING;
        const severityStr = (raw.labels?.severity || '').toLowerCase();

        let severity = AlertSeverity.MEDIUM;
        if (['critical', 'fatal', 'emergency'].includes(severityStr)) severity = AlertSeverity.CRITICAL;
        else if (['high', 'error'].includes(severityStr)) severity = AlertSeverity.HIGH;
        else if (['low', 'warning'].includes(severityStr)) severity = AlertSeverity.LOW;
        else if (['info', 'debug'].includes(severityStr)) severity = AlertSeverity.INFO;

        const fingerprint = raw.fingerprint || this.generateFingerprint(title + JSON.stringify(raw.labels || {}));

        return this.createAlertBase({
            sourceType: 'prometheus',
            sourceId: raw.labels?.alertname || 'unknown',
            severity,
            status,
            title,
            description,
            labels: raw.labels || {},
            annotations: raw.annotations || {},
            startsAt: raw.startsAt ? new Date(raw.startsAt) : new Date(),
            endsAt: raw.endsAt && !raw.endsAt.startsWith('0001') ? new Date(raw.endsAt) : undefined,
            fingerprint
        });
    }

    private normalizeGrafanaAlert(raw: any): Alert {
        const title = raw.title || raw.ruleName || 'Grafana Alert';
        const description = raw.message || 'No description provided';
        const status = raw.state === 'ok' ? AlertStatus.RESOLVED : AlertStatus.FIRING;

        const fingerprint = this.generateFingerprint(`grafana-${raw.ruleId || title}`);

        return this.createAlertBase({
            sourceType: 'grafana',
            sourceId: raw.ruleId?.toString() || title,
            severity: AlertSeverity.HIGH, // Grafana basic typically doesn't send specific severities without tags
            status,
            title,
            description,
            labels: raw.tags || {},
            annotations: { imageUrl: raw.imageUrl || '' },
            startsAt: new Date(),
            fingerprint
        });
    }

    private normalizeGenericAlert(raw: any): Alert {
        const title = raw.title || raw.name || raw.subject || 'Generic Webhook Alert';
        const description = raw.description || raw.message || raw.body || JSON.stringify(raw);
        const status = raw.status === 'resolved' || raw.status === 'ok' ? AlertStatus.RESOLVED : AlertStatus.FIRING;

        const fingerprint = this.generateFingerprint(`generic-${title}`);

        return this.createAlertBase({
            sourceType: 'webhook',
            sourceId: title,
            severity: AlertSeverity.MEDIUM,
            status,
            title,
            description,
            labels: {},
            annotations: {},
            startsAt: new Date(),
            fingerprint
        });
    }

    private createAlertBase(params: {
        sourceType: 'prometheus' | 'grafana' | 'webhook' | 'cloudwatch';
        sourceId: string;
        severity: AlertSeverity;
        status: AlertStatus;
        title: string;
        description: string;
        labels: Record<string, string>;
        annotations: Record<string, string>;
        startsAt: Date;
        endsAt?: Date;
        fingerprint: string;
    }): Alert {
        return {
            id: `alt_${nanoid(16)}`,
            source: {
                type: params.sourceType,
                name: params.sourceType,
                sourceId: params.sourceId
            },
            severity: params.severity,
            status: params.status,
            title: params.title,
            description: params.description,
            labels: params.labels,
            annotations: params.annotations,
            startsAt: params.startsAt,
            endsAt: params.endsAt,
            fingerprint: params.fingerprint,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    private generateFingerprint(input: string): string {
        return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
    }

    private isDuplicate(alert: Alert): boolean {
        const cached = this.deduplicationCache.get(alert.fingerprint);
        if (!cached) return false;

        // If status changed, we process it again (e.g. firing -> resolved)
        if (cached.status !== alert.status) return false;

        // If it's a recent duplicate of the same status, ignore it
        return true;
    }

    private cleanupCache(): void {
        const now = Date.now();
        let evictions = 0;
        for (const [key, value] of this.deduplicationCache.entries()) {
            if (now - value.timestamp > this.cacheTtlMs) {
                this.deduplicationCache.delete(key);
                evictions++;
            }
        }
        if (evictions > 0) {
            this.logger.debug({ evictions, currentSize: this.deduplicationCache.size }, 'webhook cache cleanup');
        }
    }
}
