import { createLogger, LLMGateway, LLMProvider, type HandId } from '@fangops/core';

export class KnowledgeGraphBuilder {
    private logger;

    constructor(
        private llmGateway: LLMGateway,
        private model: string,
        private provider: LLMProvider,
        private handId: HandId
    ) {
        this.logger = createLogger({ component: 'analyst:knowledge' });
    }

    public async extractEntitiesAndSummary(incidentContext: string, postmortem: string): Promise<string> {
        this.logger.info('Extracting knowledge graph entities...');

        const systemPrompt = `You are a system infrastructure analyst.
Read the incident details and postmortem, then extract key entities (services, databases, regions, APIs) involved.
Output a concise YAML-formatted list of affected components and a 2-sentence summary for the runbook database so future similar alerts can reference this incident.
Example output:
entities:
  - redis-cache
  - payment-gateway
summary: |
  Redis cache eviction caused upstream payment failures. Resolved by increasing cache memory limits.`;

        const response = await this.llmGateway.complete({
            provider: this.provider,
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Context:\n${incidentContext}\n\nPostmortem:\n${postmortem}` }
            ],
            handId: this.handId,
            temperature: 0.1
        });

        return response.content;
    }
}
