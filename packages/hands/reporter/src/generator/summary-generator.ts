import { AlertSeverity, HandStatus, LLMGateway, LLMProvider } from '@fangops/core';
import type { DailyHealthSummary } from '@fangops/core';

export interface SummaryMetrics {
    totalAlerts: number;
    criticalAlerts: number;
    resolvedAlerts: number;
    activeIncidents: number;
    resolvedIncidents: number;
    mttrMinutes?: number;
    remediationActionsCount: number;
    topIssues: Array<{ title: string; count: number; severity: AlertSeverity }>;
    llmCostUsd: number;
    handStatuses: Array<{ handId: string; name: string; status: HandStatus }>;
}

export class SummaryGenerator {
    constructor(private llmGateway: LLMGateway, private handId: string) { }

    async generate(date: Date, metrics: SummaryMetrics): Promise<DailyHealthSummary> {
        const narrative = await this.generateNarrative(metrics);

        return {
            date,
            ...metrics,
            narrative
        };
    }

    private async generateNarrative(metrics: SummaryMetrics): Promise<string> {
        const prompt = `
            You are FangOps Agent 4 (Reporter Hand). Your job is to generate a brief, professional daily health summary.
            Write a 2-3 sentence paragraph summarizing the following operational metrics over the last 24 hours.
            Focus on the most important details (critical alerts, ML costs, incidents). Maintain a calm, analytical tone.

            Total Alerts: ${metrics.totalAlerts}
            Critical Alerts: ${metrics.criticalAlerts}
            Active Incidents: ${metrics.activeIncidents}
            Resolved Incidents: ${metrics.resolvedIncidents}
            MTTR (Minutes): ${metrics.mttrMinutes || 'N/A'}
            LLM Cost: $${metrics.llmCostUsd.toFixed(2)}
            Top Issue: ${metrics.topIssues?.[0]?.title || 'None'}

            Do not use markdown formatting in the narrative. Just return plain text.
        `;

        try {
            const response = await this.llmGateway.complete({
                provider: LLMProvider.OPENAI, // Defaulting to openai as per REPORTER_CONFIG
                model: 'gpt-4o-mini',
                handId: this.handId,
                messages: [
                    { role: 'system', content: 'You are an SRE AI assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                maxTokens: 150
            });

            return response.content.trim();
        } catch (error: any) {
            // Fallback narrative if LLM fails
            return `System health report generated successfully. Failed to generate AI narrative: ${error.message}`;
        }
    }
}
