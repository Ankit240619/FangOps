import type { Alert } from '../types';
import { AlertSeverity, AlertStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class AlertFixtureGenerator {
    public static generateAlert(overrides?: Partial<Alert>): Alert {
        return {
            id: uuidv4(),
            title: 'High CPU Usage Detected',
            description: 'CPU usage has exceeded 90% for more than 5 minutes on server web-01.',
            severity: AlertSeverity.HIGH,
            source: { type: 'prometheus', name: 'Prometheus', sourceId: 'HighCPUUsage' },
            status: AlertStatus.FIRING,
            labels: { alertname: 'HighCPUUsage', instance: 'web-01' },
            annotations: {},
            fingerprint: uuidv4(),
            startsAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        } as Alert;
    }

    public static generateMultipleAlerts(count: number, overrides?: Partial<Alert>): Alert[] {
        const alerts: Alert[] = [];
        for (let i = 0; i < count; i++) {
            alerts.push(this.generateAlert({
                title: `Alert ${i + 1}`,
                ...overrides
            }));
        }
        return alerts;
    }
}
