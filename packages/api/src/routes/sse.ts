import type { FastifyInstance } from 'fastify';
import { eventBus } from '@fangops/core';

export default async function sseRoutes(app: FastifyInstance) {
    app.get('/api/v1/sse/events', { preValidation: [app.authenticate] }, async (request, reply) => {
        const headers = {
            'Content-Type': 'text/event-stream',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        };
        reply.raw.writeHead(200, headers);

        // Helper to send SSE data
        const sendEvent = (event: string, data: any) => {
            reply.raw.write(`event: ${event}\n`);
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Send initial connection event
        sendEvent('connected', { message: 'SSE Connection Established' });

        // Listeners
        const onAlertReceived = (data: any) => sendEvent('alert.received', data);
        const onAlertCorrelated = (data: any) => sendEvent('alert.correlated', data);
        const onAlertResolved = (data: any) => sendEvent('alert.resolved', data);
        const onIncidentCreated = (data: any) => sendEvent('incident.created', data);
        const onIncidentUpdated = (data: any) => sendEvent('incident.updated', data);
        const onHandStatus = (data: any) => sendEvent('hand.heartbeat', data);

        eventBus.on('alert.received', onAlertReceived);
        eventBus.on('alert.correlated', onAlertCorrelated);
        eventBus.on('alert.resolved', onAlertResolved);
        eventBus.on('incident.created', onIncidentCreated);
        eventBus.on('incident.updated', onIncidentUpdated);
        eventBus.on('hand.heartbeat', onHandStatus);
        eventBus.on('hand.started', onHandStatus);
        eventBus.on('hand.stopped', onHandStatus);
        eventBus.on('hand.error', onHandStatus);

        // Keep-alive heartbeat every 30s
        const heartbeatInterval = setInterval(() => {
            reply.raw.write(': heartbeat\n\n');
        }, 30000);

        request.raw.on('close', () => {
            clearInterval(heartbeatInterval);
            eventBus.off('alert.received', onAlertReceived);
            eventBus.off('alert.correlated', onAlertCorrelated);
            eventBus.off('alert.resolved', onAlertResolved);
            eventBus.off('incident.created', onIncidentCreated);
            eventBus.off('incident.updated', onIncidentUpdated);
            eventBus.off('hand.heartbeat', onHandStatus);
            eventBus.off('hand.started', onHandStatus);
            eventBus.off('hand.stopped', onHandStatus);
            eventBus.off('hand.error', onHandStatus);
        });
    });
}
