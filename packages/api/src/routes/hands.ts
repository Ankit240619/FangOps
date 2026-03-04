import type { FastifyInstance } from 'fastify';
import { eventBus, HandStatus, loggers } from '@fangops/core';

const log = loggers.api;

// Mock database for hands state (until full persistence is implemented for Hands config)
const mockedHands = [
    { id: 'sentinel-1', name: 'Sentinel Hand', status: HandStatus.STOPPED, description: 'Monitoring and alert correlation', llm: { provider: 'openai', model: 'gpt-4o' } },
    { id: 'reporter-1', name: 'Reporter Hand', status: HandStatus.STOPPED, description: 'Daily health summaries and notifications', llm: { provider: 'openai', model: 'gpt-4o' } },
];

export default async function handRoutes(app: FastifyInstance) {
    app.get('/api/v1/hands', { preValidation: [app.authenticate] }, async (_request, _reply) => {
        return {
            success: true,
            data: mockedHands,
            meta: { total: mockedHands.length }
        };
    });

    app.post('/api/v1/hands/:id/start', { preValidation: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const hand = mockedHands.find(h => h.id === id);
        if (!hand) return reply.status(404).send({ success: false });

        hand.status = HandStatus.RUNNING;
        log.info({ handId: id }, 'Hand started via API');

        eventBus.emit('hand.started', { handId: id, status: HandStatus.RUNNING } as any);

        return { success: true, data: hand };
    });

    app.post('/api/v1/hands/:id/stop', { preValidation: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const hand = mockedHands.find(h => h.id === id);
        if (!hand) return reply.status(404).send({ success: false });

        hand.status = HandStatus.STOPPED;
        log.info({ handId: id }, 'Hand stopped via API');

        eventBus.emit('hand.stopped', { handId: id, status: HandStatus.STOPPED } as any);

        return { success: true, data: hand };
    });

    app.post('/api/v1/hands/:id/pause', { preValidation: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const hand = mockedHands.find(h => h.id === id);
        if (!hand) return reply.status(404).send({ success: false });

        hand.status = HandStatus.PAUSED;
        log.info({ handId: id }, 'Hand paused via API');

        return { success: true, data: hand };
    });
}
