import { nanoid } from 'nanoid';
import { createLogger, EventBus, AlertSeverity, AlertStatus } from '@fangops/core';
import type { Alert } from '@fangops/core';
import crypto from 'crypto';

export class PrometheusAdapter {
    private logger = createLogger({ component: 'prometheus-adapter', handName: 'sentinel' });
    private eventBus = EventBus.getInstance();
    private isPolling = false;
    private pollInterval: NodeJS.Timeout | null = null;

    // Deduplication cache specific to polling to avoid emitting the same firing alert over and over
    private knownFiringAlerts = new Set<string>();

    constructor(
        private prometheusUrl: string,
        private pollIntervalMs = 30000 // 30 seconds default
    ) { }

    public start(): void {
        if (!this.prometheusUrl) {
            this.logger.warn('No Prometheus URL configured, Prometheus polling is disabled.');
            return;
        }

        this.logger.info(`Starting Prometheus Adapter, polling ${this.prometheusUrl} every ${this.pollIntervalMs}ms`);
        this.isPolling = true;
        this.poll(); // initial poll

        this.pollInterval = setInterval(() => {
            if (this.isPolling) this.poll();
        }, this.pollIntervalMs);
        this.pollInterval.unref();
    }

    public stop(): void {
        this.isPolling = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.logger.info('Stopping Prometheus Adapter...');
    }

    private async poll(): Promise<void> {
        try {
            const response = await fetch(`${this.prometheusUrl}/api/v1/alerts`);
            if (!response.ok) {
                throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            if (data.status !== 'success') {
                throw new Error(`Prometheus returned error status: ${data.error}`);
            }

            this.processAlerts(data.data?.alerts || []);

        } catch (error) {
            this.logger.error({ err: error }, 'Failed to poll Prometheus for alerts');
            // Backoff is handled naturally by the fixed interval, 
            // but an advanced implementation could exponentially increase this.pollIntervalMs
        }
    }

    private processAlerts(rawAlerts: any[]): void {
        const currentlyFiring = new Set<string>();

        for (const raw of rawAlerts) {
            try {
                const alert = this.normalize(raw);
                if (!alert) continue;

                if (alert.status === AlertStatus.FIRING) {
                    currentlyFiring.add(alert.fingerprint);

                    if (!this.knownFiringAlerts.has(alert.fingerprint)) {
                        // New firing alert
                        this.logger.info({ alertId: alert.id, title: alert.title }, 'Polled new Prometheus alert');
                        this.knownFiringAlerts.add(alert.fingerprint);
                        this.eventBus.emit('alert.received', alert);
                    }
                }
            } catch (err) {
                this.logger.warn({ err, raw }, 'Failed to normalize Prometheus alert');
            }
        }

        // Cleanup resolved auto-firing alerts
        for (const fingerprint of this.knownFiringAlerts) {
            if (!currentlyFiring.has(fingerprint)) {
                this.knownFiringAlerts.delete(fingerprint);
                // Note: We don't automatically emit "resolved" here because Prometheus 
                // Alertmanager sends webhooks for that, and polling /api/v1/alerts only shows active ones.
                // We just stop tracking it.
            }
        }
    }

    /**
     * Public method for the Hand to query specific metric contexts
     */
    public async queryMetric(query: string): Promise<any> {
        if (!this.prometheusUrl) return null;

        try {
            const url = new URL(`${this.prometheusUrl}/api/v1/query`);
            url.searchParams.append('query', query);

            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`Prometheus Query API error: ${response.status}`);
            }

            const data = await response.json() as any;
            return data.data?.result;
        } catch (error) {
            this.logger.error({ err: error, query }, 'Prometheus context query failed');
            return null;
        }
    }

    private normalize(raw: any): Alert | null {
        if (!raw || !raw.labels) return null;

        const title = raw.annotations?.summary || raw.labels.alertname || 'Prometheus Alert';
        const description = raw.annotations?.description || 'No description provided';
        const status = raw.state === 'firing' ? AlertStatus.FIRING : AlertStatus.RESOLVED;
        const severityStr = (raw.labels.severity || '').toLowerCase();

        let severity = AlertSeverity.MEDIUM;
        if (['critical', 'fatal', 'emergency'].includes(severityStr)) severity = AlertSeverity.CRITICAL;
        else if (['high', 'error'].includes(severityStr)) severity = AlertSeverity.HIGH;
        else if (['low', 'warning'].includes(severityStr)) severity = AlertSeverity.LOW;
        else if (['info', 'debug'].includes(severityStr)) severity = AlertSeverity.INFO;

        // Ensure stable fingerprint for Prometheus active alerts
        const fingerprintInput = raw.labels.alertname + JSON.stringify(raw.labels);
        const fingerprint = crypto.createHash('sha256').update(fingerprintInput).digest('hex').substring(0, 16);

        return {
            id: `alt_${nanoid(16)}`,
            source: {
                type: 'prometheus',
                name: 'prometheus',
                sourceId: raw.labels.alertname || 'unknown'
            },
            severity,
            status,
            title,
            description,
            labels: raw.labels,
            annotations: raw.annotations || {},
            startsAt: raw.activeAt ? new Date(raw.activeAt) : new Date(),
            fingerprint,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
}
