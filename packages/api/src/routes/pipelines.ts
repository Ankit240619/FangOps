import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { alerts } from '../db/schema.js';
import { isNotNull, desc, or } from 'drizzle-orm';

export default async function pipelineRoutes(app: FastifyInstance) {
    // Get all alerts that relate to data pipelines (has DAG ID or dbt Model)
    app.get('/api/v1/pipelines/alerts', { preValidation: [app.authenticate] }, async (_request, _reply) => {
        const results = await db
            .select()
            .from(alerts)
            .where(
                or(isNotNull(alerts.dagId), isNotNull(alerts.dbtModel))
            )
            .orderBy(desc(alerts.createdAt))
            .all();

        return { success: true, data: results };
    });

    // Get aggregated pipeline health statistics
    app.get('/api/v1/pipelines/health', { preValidation: [app.authenticate] }, async (_request, _reply) => {
        const pipelineAlerts = await db
            .select()
            .from(alerts)
            .where(
                or(isNotNull(alerts.dagId), isNotNull(alerts.dbtModel))
            )
            .all();

        const activePipelineAlerts = pipelineAlerts.filter(a => a.status === 'firing' || a.status === 'acknowledged');
        const dbtFailures = activePipelineAlerts.filter(a => !!a.dbtModel).length;
        const airflowFailures = activePipelineAlerts.filter(a => !!a.dagId).length;

        return {
            success: true,
            data: {
                totalPipelineAlerts: pipelineAlerts.length,
                activeFailures: activePipelineAlerts.length,
                breakdown: {
                    airflow: airflowFailures,
                    dbt: dbtFailures
                },
                status: activePipelineAlerts.length === 0 ? 'healthy' : 'degraded'
            }
        };
    });
}
