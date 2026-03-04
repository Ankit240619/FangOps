import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { alerts } from '../db/schema.js';
import { desc, count } from 'drizzle-orm';

export default async function alertRoutes(app: FastifyInstance) {
    app.get('/api/v1/alerts', { preValidation: [app.authenticate] }, async (request, _reply) => {
        // Simple pagination
        const query = request.query as any;
        const page = parseInt(query.page || '1');
        const pageSize = parseInt(query.pageSize || '50');
        const offset = (page - 1) * pageSize;

        const results = await db.select().from(alerts)
            .orderBy(desc(alerts.startsAt))
            .limit(pageSize)
            .offset(offset)
            .all();

        const totalResult = await db.select({ value: count() }).from(alerts).get();

        return {
            success: true,
            data: results.map(r => {
                let sourceData = r.source;
                try { sourceData = JSON.parse(r.source); } catch (e) { /* keep as string/object */ }

                let labelsData = r.labels;
                if (r.labels) {
                    try { labelsData = JSON.parse(r.labels); } catch (e) { /* keep as string/object */ }
                }

                return { ...r, source: sourceData, labels: labelsData };
            }),
            meta: {
                page,
                pageSize,
                total: totalResult?.value || 0
            }
        };
    });

    app.get('/api/v1/alerts/stats', { preValidation: [app.authenticate] }, async (_request, _reply) => {
        const total = await db.select({ value: count() }).from(alerts).get();

        // In a real implementation we'd group by severity and status here
        // Using stub stats for now to unblock UI dev
        return {
            success: true,
            data: {
                total: total?.value || 0,
                active: 0,
                critical: 0,
            }
        };
    });
}
