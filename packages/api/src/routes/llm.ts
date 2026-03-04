import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { llmCosts } from '../db/schema.js';
import { desc, sum } from 'drizzle-orm';
import { LLMProvider } from '@fangops/core';

export default async function llmRoutes(app: FastifyInstance) {
    app.get('/api/v1/llm/costs', { preValidation: [app.authenticate] }, async (_request, _reply) => {
        const costs = await db.select().from(llmCosts).orderBy(desc(llmCosts.timestamp)).limit(100).all();
        const total = await db.select({ totalCost: sum(llmCosts.costUsd) }).from(llmCosts).get();

        return {
            success: true,
            data: {
                recent: costs,
                totalCostUsd: total?.totalCost || 0,
            },
        };
    });

    app.get('/api/v1/llm/providers', { preValidation: [app.authenticate] }, async (_request, _reply) => {
        return {
            success: true,
            data: Object.values(LLMProvider),
        };
    });
}
