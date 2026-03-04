import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { incidents, incidentTimeline } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export default async function incidentRoutes(app: FastifyInstance) {
    app.get('/api/v1/incidents', { preValidation: [app.authenticate] }, async (_request, _reply) => {
        const results = await db.select().from(incidents).orderBy(desc(incidents.createdAt)).all();

        return {
            success: true,
            data: results,
        };
    });

    app.get('/api/v1/incidents/:id', { preValidation: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const incident = await db.select().from(incidents).where(eq(incidents.id, id)).get();

        if (!incident) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Incident not found' } });
        }

        const timeline = await db.select().from(incidentTimeline).where(eq(incidentTimeline.incidentId, id)).orderBy(desc(incidentTimeline.timestamp)).all();

        return {
            success: true,
            data: {
                ...incident,
                timeline,
            },
        };
    });

    app.post('/api/v1/incidents/:id/comment', { preValidation: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { message } = request.body as { message: string };

        const incident = await db.select().from(incidents).where(eq(incidents.id, id)).get();
        if (!incident) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Incident not found' } });
        }

        const entry = {
            id: uuidv4(),
            incidentId: id,
            type: 'comment',
            actor: request.user.email,
            message,
        };

        await db.insert(incidentTimeline).values(entry);

        return { success: true, data: entry };
    });
    app.patch('/api/v1/incidents/:id', { preValidation: [app.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const updates = request.body as Partial<{ status: string, rca: string, resolvedAt: number }>;

        const incident = await db.select().from(incidents).where(eq(incidents.id, id)).get();
        if (!incident) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Incident not found' } });
        }

        const dataToUpdate: any = { ...updates, updatedAt: new Date() };
        if (updates.resolvedAt) {
            dataToUpdate.resolvedAt = new Date(updates.resolvedAt);
        }

        const updated = await db.update(incidents)
            .set(dataToUpdate)
            .where(eq(incidents.id, id))
            .returning()
            .get();

        return { success: true, data: updated };
    });
}
