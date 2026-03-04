import { db } from './index.js';
import { users, alerts, incidents, incidentTimeline, remediationActions } from './schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { UserRole, loggers } from '@fangops/core';

const log = loggers.api;

/**
 * Seed demo data: a viewer account and realistic sample data.
 * Only runs if the demo user doesn't already exist.
 */
export async function seedDemoData() {
    const demoExists = await db.select().from(users).where(eq(users.email, 'demo@fangops.live')).get();
    if (demoExists) return; // Already seeded

    log.info('Seeding demo data for live preview...');

    // 1. Create demo viewer account
    await db.insert(users).values({
        id: uuidv4(),
        email: 'demo@fangops.live',
        name: 'Demo Viewer',
        role: UserRole.VIEWER,
        passwordHash: await bcrypt.hash('demo', 10),
        createdAt: new Date(),
    });

    // 2. Realistic alerts
    const now = new Date();
    const alertData = [
        {
            id: uuidv4(), source: 'prometheus', severity: 'critical', status: 'firing',
            title: 'CPU usage > 95% on prod-web-03',
            description: 'CPU utilization has exceeded 95% for more than 5 minutes on production web server 03. This may impact response times for customer-facing APIs.',
            labels: JSON.stringify({ instance: 'prod-web-03', job: 'node-exporter', region: 'us-east-1' }),
            fingerprint: 'cpu-prod-web-03', startsAt: new Date(now.getTime() - 15 * 60000), createdAt: now, updatedAt: now,
        },
        {
            id: uuidv4(), source: 'prometheus', severity: 'critical', status: 'firing',
            title: 'Disk space < 5% on prod-db-01',
            description: 'Root filesystem on the primary database server is nearly full. Immediate action required to prevent database crashes.',
            labels: JSON.stringify({ instance: 'prod-db-01', job: 'node-exporter', mountpoint: '/' }),
            fingerprint: 'disk-prod-db-01', startsAt: new Date(now.getTime() - 45 * 60000), createdAt: now, updatedAt: now,
        },
        {
            id: uuidv4(), source: 'prometheus', severity: 'warning', status: 'firing',
            title: 'Memory usage > 85% on prod-api-02',
            description: 'Memory pressure detected. The API server may start OOM-killing processes if usage continues to climb.',
            labels: JSON.stringify({ instance: 'prod-api-02', job: 'node-exporter', env: 'production' }),
            fingerprint: 'mem-prod-api-02', startsAt: new Date(now.getTime() - 30 * 60000), createdAt: now, updatedAt: now,
        },
        {
            id: uuidv4(), source: 'prometheus', severity: 'warning', status: 'resolved',
            title: 'High error rate on /api/v1/checkout',
            description: 'HTTP 500 error rate exceeded 5% threshold on the checkout endpoint. Payment processing may have been affected.',
            labels: JSON.stringify({ service: 'checkout-api', endpoint: '/api/v1/checkout', method: 'POST' }),
            fingerprint: 'err-checkout-api', startsAt: new Date(now.getTime() - 120 * 60000),
            endsAt: new Date(now.getTime() - 60 * 60000), createdAt: now, updatedAt: now,
        },
        {
            id: uuidv4(), source: 'airflow', severity: 'critical', status: 'firing',
            title: 'DAG etl_customer_data failed 3 consecutive runs',
            description: 'The customer data ETL pipeline has failed for the last 3 scheduled runs. Downstream dbt models are stale.',
            labels: JSON.stringify({ dag_id: 'etl_customer_data', task_id: 'extract_from_postgres' }),
            dagId: 'etl_customer_data',
            fingerprint: 'dag-etl-customer', startsAt: new Date(now.getTime() - 90 * 60000), createdAt: now, updatedAt: now,
        },
        {
            id: uuidv4(), source: 'prometheus', severity: 'info', status: 'firing',
            title: 'SSL certificate expires in 7 days for api.example.com',
            description: 'The TLS certificate for api.example.com will expire on 2026-03-11. Auto-renewal should handle this, but monitoring just in case.',
            labels: JSON.stringify({ domain: 'api.example.com', issuer: 'LetsEncrypt' }),
            fingerprint: 'ssl-api-example', startsAt: new Date(now.getTime() - 5 * 60000), createdAt: now, updatedAt: now,
        },
        {
            id: uuidv4(), source: 'kubernetes', severity: 'warning', status: 'firing',
            title: 'Pod CrashLoopBackOff: payment-service-7f8d9c',
            description: 'Payment service pod is crash-looping. Last exit code: 137 (OOMKilled). 12 restarts in the last hour.',
            labels: JSON.stringify({ namespace: 'production', pod: 'payment-service-7f8d9c', container: 'payment-api' }),
            fingerprint: 'pod-payment-crash', startsAt: new Date(now.getTime() - 60 * 60000), createdAt: now, updatedAt: now,
        },
        {
            id: uuidv4(), source: 'dbt', severity: 'warning', status: 'firing',
            title: 'Schema drift detected: dim_customers.loyalty_tier added',
            description: 'A new column `loyalty_tier` (VARCHAR) was detected in the dim_customers table that is not defined in the dbt schema. This may indicate an untracked migration.',
            labels: JSON.stringify({ model: 'dim_customers', database: 'analytics_prod' }),
            dbtModel: 'dim_customers',
            fingerprint: 'drift-dim-customers', startsAt: new Date(now.getTime() - 25 * 60000), createdAt: now, updatedAt: now,
        },
    ];

    for (const alert of alertData) {
        await db.insert(alerts).values(alert);
    }

    // 3. Realistic incidents
    const incidentId1 = uuidv4();
    const incidentId2 = uuidv4();
    const incidentId3 = uuidv4();

    await db.insert(incidents).values([
        {
            id: incidentId1, title: 'Production Database Disk Full',
            description: 'Root filesystem on prod-db-01 reached 97% capacity. Correlated alerts: disk space critical, slow query warnings, connection pool exhaustion.',
            status: 'investigating', severity: 'critical',
            rca: '## Root Cause\nOld query logs were not being rotated due to a misconfigured logrotate cron job. The `/var/log/postgresql` directory grew to 45GB over 2 weeks.\n\n## Impact\n- Database write operations slowed by 300%\n- 23 API timeout errors in the last hour\n- Customer checkout flow affected for ~12 minutes\n\n## Resolution\n- Cleared old logs: `sudo rm /var/log/postgresql/postgresql-14-main.log.*.gz`\n- Fixed logrotate config: set maxsize to 100M with 7-day retention\n- Freed 43GB of disk space',
            createdAt: new Date(now.getTime() - 40 * 60000), updatedAt: now,
        },
        {
            id: incidentId2, title: 'Payment Service OOM Crash Loop',
            description: 'payment-service pod restarting repeatedly due to memory limit exceeded (OOMKilled). Correlated with spike in checkout traffic.',
            status: 'mitigating', severity: 'critical',
            createdAt: new Date(now.getTime() - 55 * 60000), updatedAt: now,
        },
        {
            id: incidentId3, title: 'Checkout API High Error Rate',
            description: 'HTTP 500 errors spiked to 8% on /api/v1/checkout due to upstream payment gateway timeout. Resolved after gateway recovered.',
            status: 'resolved', severity: 'warning',
            createdAt: new Date(now.getTime() - 130 * 60000), updatedAt: now,
            resolvedAt: new Date(now.getTime() - 60 * 60000),
        },
    ]);

    // 4. Incident timelines
    await db.insert(incidentTimeline).values([
        { id: uuidv4(), incidentId: incidentId1, type: 'alert', actor: 'Sentinel Hand', message: 'Correlated 3 alerts: disk-prod-db-01, slow-queries, conn-pool-exhaustion', timestamp: new Date(now.getTime() - 40 * 60000) },
        { id: uuidv4(), incidentId: incidentId1, type: 'classification', actor: 'Sentinel Hand', message: 'Classified as CRITICAL — Storage: disk capacity exceeded safe threshold', timestamp: new Date(now.getTime() - 39 * 60000) },
        { id: uuidv4(), incidentId: incidentId1, type: 'rca', actor: 'Analyst Hand', message: 'Root cause identified: unrotated PostgreSQL logs consuming 45GB. Knowledge graph updated.', timestamp: new Date(now.getTime() - 35 * 60000) },
        { id: uuidv4(), incidentId: incidentId1, type: 'remediation', actor: 'Resolver Hand', message: 'Proposed: Clear old logs and fix logrotate config (Tier: APPROVAL_REQUIRED)', timestamp: new Date(now.getTime() - 34 * 60000) },
        { id: uuidv4(), incidentId: incidentId1, type: 'notification', actor: 'Reporter Hand', message: 'Sent critical alert to #ops-incidents Slack channel and on-call engineer via Telegram', timestamp: new Date(now.getTime() - 38 * 60000) },

        { id: uuidv4(), incidentId: incidentId2, type: 'alert', actor: 'Sentinel Hand', message: 'Detected CrashLoopBackOff on payment-service-7f8d9c. 12 restarts in 60 minutes.', timestamp: new Date(now.getTime() - 55 * 60000) },
        { id: uuidv4(), incidentId: incidentId2, type: 'remediation', actor: 'Resolver Hand', message: 'Auto-scaled memory limit from 512Mi to 1Gi (Tier: SAFE — auto-approved)', timestamp: new Date(now.getTime() - 50 * 60000) },
        { id: uuidv4(), incidentId: incidentId2, type: 'notification', actor: 'Reporter Hand', message: 'Sent incident update to #payments-team Slack channel', timestamp: new Date(now.getTime() - 49 * 60000) },

        { id: uuidv4(), incidentId: incidentId3, type: 'alert', actor: 'Sentinel Hand', message: 'High error rate detected on checkout endpoint. 500s at 8% (threshold: 5%)', timestamp: new Date(now.getTime() - 130 * 60000) },
        { id: uuidv4(), incidentId: incidentId3, type: 'rca', actor: 'Analyst Hand', message: 'Root cause: upstream payment gateway (Stripe) experienced 45s of elevated latency', timestamp: new Date(now.getTime() - 125 * 60000) },
        { id: uuidv4(), incidentId: incidentId3, type: 'resolved', actor: 'Sentinel Hand', message: 'Error rate returned to normal (0.2%). Incident auto-resolved.', timestamp: new Date(now.getTime() - 60 * 60000) },
    ]);

    // 5. Remediation actions
    await db.insert(remediationActions).values([
        {
            id: uuidv4(), incidentId: incidentId1, action: 'clear_old_logs',
            description: 'Remove PostgreSQL log files older than 7 days and fix logrotate configuration',
            tier: 'APPROVAL', status: 'pending_approval', executor: 'SSHAdapter',
            proposedAt: new Date(now.getTime() - 34 * 60000),
        },
        {
            id: uuidv4(), incidentId: incidentId2, action: 'scale_memory',
            description: 'Increase payment-service memory limit from 512Mi to 1Gi via kubectl patch',
            tier: 'SAFE', status: 'executed', executor: 'KubernetesAdapter',
            output: 'deployment.apps/payment-service patched\nRollout status: 2/2 replicas updated',
            proposedAt: new Date(now.getTime() - 50 * 60000),
            executedAt: new Date(now.getTime() - 49 * 60000),
        },
    ]);

    log.info('Demo data seeded: 8 alerts, 3 incidents, 11 timeline events, 2 remediation actions');
}
