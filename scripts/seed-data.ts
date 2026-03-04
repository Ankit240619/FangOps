import { db } from '../packages/api/src/db/index.js';
import { users, alerts, incidents, incidentTimeline, remediationActions, llmCosts } from '../packages/api/src/db/schema.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, AlertSeverity, AlertStatus, IncidentStatus, RemediationTier, LLMProvider } from '@fangops/core';

async function main() {
    console.log('🌱 Seeding FangOps Database...');

    // 1. Create Default User
    const passwordHash = await bcrypt.hash('admin', 10);
    const adminId = uuidv4();
    try {
        await db.insert(users).values({
            id: adminId,
            email: 'demo@fangops.local',
            name: 'Demo Admin',
            role: UserRole.ADMIN,
            passwordHash,
            createdAt: new Date(),
        });
        console.log('✅ Created Demo Admin (demo@fangops.local / admin)');
    } catch (e: any) {
        if (e.message.includes('UNIQUE constraint failed')) {
            console.log('ℹ️ Demo Admin already exists.');
        } else {
            throw e;
        }
    }

    // 2. Create Sample Alerts
    const alert1Id = uuidv4();
    const alert2Id = uuidv4();

    await db.insert(alerts).values([
        {
            id: alert1Id,
            source: JSON.stringify({ type: 'prometheus', name: 'Prometheus Main', sourceId: 'HighMemoryUsage' }),
            severity: AlertSeverity.CRITICAL,
            status: AlertStatus.FIRING,
            title: 'High Memory Usage on API-65f88b',
            description: 'Pod api-65f88b memory usage exceeded 95% for 5m',
            labels: JSON.stringify({ pod: 'api-65f88b', namespace: 'production' }),
            annotations: JSON.stringify({ runbook: 'https://wiki/memory-leak' }),
            fingerprint: 'mem-api-prod',
            startsAt: new Date(Date.now() - 3600000), // 1 hour ago
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: alert2Id,
            source: JSON.stringify({ type: 'grafana', name: 'Grafana Secondary', sourceId: 'PaymentGatewayTimeout' }),
            severity: AlertSeverity.HIGH,
            status: AlertStatus.CORRELATED,
            title: 'Payment Gateway Timeouts > 5s',
            description: 'Stripe API latency spikes observed across 3 regions',
            labels: JSON.stringify({ service: 'payments', region: 'us-east-1' }),
            fingerprint: 'stripe-latency-p99',
            startsAt: new Date(Date.now() - 1800000), // 30 mins ago
            createdAt: new Date(),
            updatedAt: new Date(),
        }
    ]);
    console.log('✅ Created Alerts');

    // 3. Create Sample Incident
    const incidentId = uuidv4();
    await db.insert(incidents).values({
        id: incidentId,
        title: 'Payment Gateway Degradation',
        description: 'Multiple alerts indicating severe latency communicating with Stripe API.',
        status: IncidentStatus.INVESTIGATING,
        severity: AlertSeverity.CRITICAL,
        rca: 'Pending Analyst Hand report...',
        createdAt: new Date(Date.now() - 1800000),
        updatedAt: new Date(),
    });
    console.log('✅ Created Incident');

    // 4. Create Incident Timeline
    await db.insert(incidentTimeline).values([
        {
            id: uuidv4(),
            incidentId,
            type: 'status_change',
            actor: 'system',
            message: 'Incident opened and assigned severity CRITICAL',
            timestamp: new Date(Date.now() - 1800000),
        },
        {
            id: uuidv4(),
            incidentId,
            type: 'comment',
            actor: 'SentinelHand',
            message: 'Correlated 2 related alerts involving payments and network latency.',
            metadata: JSON.stringify({ alerts: [alert1Id, alert2Id] }),
            timestamp: new Date(Date.now() - 1700000),
        }
    ]);

    // 5. Create Remediation Action (Pending Approval)
    await db.insert(remediationActions).values({
        id: uuidv4(),
        incidentId,
        action: 'Restart Pod',
        description: 'Restart the api-65f88b pod to clear the memory leak temporarily.',
        tier: RemediationTier.APPROVAL,
        status: 'pending_approval',
        executor: 'kubectl',
        proposedAt: new Date(),
    });
    console.log('✅ Created Remediation Actions / Approvals');

    // 6. Create LLM Cost entry
    await db.insert(llmCosts).values({
        id: uuidv4(),
        requestId: 'req_12345',
        handId: 'sentinel',
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o',
        promptTokens: 1450,
        completionTokens: 250,
        costUsd: 0.015,
        timestamp: new Date()
    });
    console.log('✅ Created Cost Analytics');

    console.log('🎉 Seeding complete.');
}

main().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
