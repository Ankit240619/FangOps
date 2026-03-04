import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { remediationActions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { eventBus } from '@fangops/core';

export default async function remediationRoutes(app: FastifyInstance) {
    // Get all remediation actions (for dashboard)
    app.get('/api/v1/remediation', { preValidation: [app.authenticate] }, async (_request, _reply) => {
        const results = await db.select().from(remediationActions).orderBy(desc(remediationActions.proposedAt)).all();
        return { success: true, data: results };
    });

    // Approve an action
    app.post('/api/v1/remediation/:id/approve', { preValidation: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const action = await db.select().from(remediationActions).where(eq(remediationActions.id, id)).get();

        if (!action) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Action not found' } });
        }

        if (action.status !== 'pending_approval') {
            return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: 'Action is not pending approval' } });
        }

        // Update DB
        const updated = await db.update(remediationActions)
            .set({ status: 'approved' })
            .where(eq(remediationActions.id, id))
            .returning()
            .get();

        // Emit event for Resolver Hand
        eventBus.emit('remediation.approved', updated as any);

        return { success: true, data: updated };
    });

    // Reject an action
    app.post('/api/v1/remediation/:id/reject', { preValidation: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const action = await db.select().from(remediationActions).where(eq(remediationActions.id, id)).get();

        if (!action) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Action not found' } });
        }

        if (action.status !== 'pending_approval') {
            return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: 'Action is not pending approval' } });
        }

        const updated = await db.update(remediationActions)
            .set({ status: 'rejected' })
            .where(eq(remediationActions.id, id))
            .returning()
            .get();

        eventBus.emit('remediation.rejected', updated as any);

        return { success: true, data: updated };
    });
}
