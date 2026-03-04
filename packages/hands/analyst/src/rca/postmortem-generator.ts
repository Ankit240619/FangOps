import { createLogger, LLMGateway, LLMProvider, type HandId } from '@fangops/core';

export class PostmortemGenerator {
    private logger;

    constructor(
        private llmGateway: LLMGateway,
        private model: string,
        private provider: LLMProvider,
        private handId: HandId
    ) {
        this.logger = createLogger({ component: 'analyst:rca' });
    }

    public async generatePostmortem(incidentContext: string): Promise<string> {
        this.logger.info('Generating postmortem via LLM...');

        const systemPrompt = `You are an expert SRE / DevOps Engineer creating a Root Cause Analysis (RCA) Postmortem document.
Based on the provided incident data, generate a comprehensive, Markdown-formatted Postmortem.
Your output MUST include exactly these headings:
# Incident Summary
# Root Cause
# Timeline of Events
# Action Items`;

        const response = await this.llmGateway.complete({
            provider: this.provider,
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: incidentContext }
            ],
            handId: this.handId,
            temperature: 0.2 // low temp for factual document
        });

        return response.content;
    }
}
