import { describe, it, expect, vi } from 'vitest';
import { SummaryGenerator } from '../generator/summary-generator.js';
import { LLMGateway } from '@fangops/core';

describe('SummaryGenerator', () => {
    it('should return a generated narrative string combined with metrics', async () => {
        const mockGateway = new LLMGateway({} as any);

        // Mock the complete method
        vi.spyOn(mockGateway, 'complete').mockResolvedValue({
            requestId: 'req-1',
            provider: 'openai',
            model: 'gpt-4o-mini',
            content: 'The systems are running smoothly.',
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            costUsd: 0.001,
            latencyMs: 500
        } as any);

        const generator = new SummaryGenerator(mockGateway, 'reporter-1');

        const metrics = {
            totalAlerts: 10,
            criticalAlerts: 0,
            resolvedAlerts: 10,
            activeIncidents: 0,
            resolvedIncidents: 1,
            remediationActionsCount: 0,
            topIssues: [],
            llmCostUsd: 0.5,
            handStatuses: []
        };

        const result = await generator.generate(new Date('2026-03-01'), metrics);

        expect(result.narrative).toBe('The systems are running smoothly.');
        expect(result.totalAlerts).toBe(10);
        expect(mockGateway.complete).toHaveBeenCalledTimes(1);

        // Validate prompt includes the metrics
        const callArgs = vi.mocked(mockGateway.complete).mock.calls[0]?.[0];
        const userPromptArgs = callArgs?.messages.find(m => m.role === 'user');
        expect(userPromptArgs?.content).toContain('Total Alerts: 10');
    });

    it('should return a fallback message if LLM fails', async () => {
        const mockGateway = new LLMGateway({} as any);
        vi.spyOn(mockGateway, 'complete').mockRejectedValue(new Error('Rate limit exceeded'));

        const generator = new SummaryGenerator(mockGateway, 'reporter-1');

        const result = await generator.generate(new Date(), {
            totalAlerts: 1,
            criticalAlerts: 0,
            resolvedAlerts: 1,
            activeIncidents: 0,
            resolvedIncidents: 0,
            remediationActionsCount: 0,
            topIssues: [],
            llmCostUsd: 0,
            handStatuses: []
        });

        expect(result.narrative).toContain('System health report generated successfully');
        expect(result.narrative).toContain('Failed to generate AI narrative: Rate limit exceeded');
    });
});
