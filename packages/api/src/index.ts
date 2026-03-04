import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig, validateLLMConfig, loggers, eventBus, UserRole } from '@fangops/core';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import sseRoutes from './routes/sse.js';
import alertRoutes from './routes/alerts.js';
import incidentRoutes from './routes/incidents.js';
import handRoutes from './routes/hands.js';
import llmRoutes from './routes/llm.js';
import remediationRoutes from './routes/remediation.js';
import pipelineRoutes from './routes/pipelines.js';
import { db, initializeDatabase } from './db/index.js';
import { seedDemoData } from './db/seed.js';
import { users } from './db/schema.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

// ============================================
// FangOps API Server — Entry Point
// ============================================

const log = loggers.api;

export async function buildApp() {
    const config = loadConfig();
    validateLLMConfig(config);

    // Auto-create tables if they don't exist (critical for fresh Docker volumes)
    await initializeDatabase();

    const app = Fastify({ logger: false });

    await app.register(cors, {
        origin: true, // Allow all origins for demo; restrict in production
    });

    await app.register(authPlugin);

    // Setup default admin user if no users exist
    const adminExists = await db.select().from(users).where(eq(users.role, UserRole.ADMIN)).get();
    if (!adminExists) {
        log.info('No admin user found. Creating default admin: admin@fangops.local');
        await db.insert(users).values({
            id: uuidv4(),
            email: 'admin@fangops.local',
            name: 'Default Admin',
            role: UserRole.ADMIN,
            passwordHash: await bcrypt.hash('admin', 10),
            createdAt: new Date(),
        });
    }

    // Seed demo data (viewer account + sample alerts/incidents)
    await seedDemoData();

    await app.register(authRoutes);
    await app.register(sseRoutes);
    await app.register(alertRoutes);
    await app.register(incidentRoutes);
    await app.register(handRoutes);
    await app.register(llmRoutes);
    await app.register(remediationRoutes);
    await app.register(pipelineRoutes);

    app.get('/health', async () => ({
        status: 'ok',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    }));

    app.get('/api/v1/info', async () => ({
        name: 'FangOps',
        version: '0.1.0',
        description: 'AI Agent Control Plane for IT & Business Operations',
        hands: [],
        channels: [],
    }));

    app.post('/api/v1/alerts/webhook', async (request, reply) => {
        const payload = request.body;
        log.info('Alert webhook received; dispatching to EventBus as webhook.received');
        eventBus.emit('webhook.received', payload);
        return reply.status(202).send({ success: true, message: 'Alert queued for processing' });
    });

    return app;
}

async function main() {
    const config = loadConfig();
    const app = await buildApp();

    try {
        await app.listen({ port: config.apiPort, host: config.apiHost });
        log.info(`FangOps API running at http://${config.apiHost}:${config.apiPort}`);
        log.info(`   Health: http://localhost:${config.apiPort}/health`);
        log.info(`   Environment: ${config.nodeEnv}`);
    } catch (err) {
        log.error({ err }, 'Failed to start FangOps API');
        process.exit(1);
    }

    const shutdown = async (signal: string) => {
        log.info(`${signal} received — shutting down gracefully...`);
        eventBus.emit('system.shutdown', { reason: signal, timestamp: new Date() });
        await app.close();
        process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

if (process.env.NODE_ENV !== 'test') {
    main().catch((err) => {
        console.error('Fatal error during startup:', err);
        process.exit(1);
    });
}
