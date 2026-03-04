import { BaseHand, type HandConfig, LLMProvider, RemediationTier, LLMGateway, eventBus, IncidentStatus } from '@fangops/core';
import type { Incident } from '@fangops/core';
import { loadConfig } from '@fangops/core';

import { IncidentAggregator } from './aggregator/incident-aggregator.js';
import { PostmortemGenerator } from './rca/postmortem-generator.js';
import { KnowledgeGraphBuilder } from './knowledge/graph-builder.js';

const ANALYST_CONFIG: HandConfig = {
    id: 'analyst-001',
    name: 'analyst',
    description: 'Generates RCA Postmortems and extracts knowledge graph data',
    version: '0.1.0',
    tools: ['query_incident_history', 'update_incident_rca'],
    llm: {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o', // using a powerful model for good RCAs
        temperature: 0.2, // Low temp for more factual generation
    },
    budget: {
        dailyLimitUsd: 10.0,
        monthlyLimitUsd: 200.0,
    },
    remediationTier: RemediationTier.OBSERVE,
    settings: {}, // Analyst doesn't need specific settings right now
};

export class AnalystHand extends BaseHand {
    private aggregator!: IncidentAggregator;
    private postmortemGenerator!: PostmortemGenerator;
    private graphBuilder!: KnowledgeGraphBuilder;
    private llmGateway!: LLMGateway;

    // Use proper typing for the bound handler
    private boundIncidentResolvedHandler!: (incident: Incident) => Promise<void>;

    constructor() {
        super(ANALYST_CONFIG);
        this.boundIncidentResolvedHandler = this.handleIncidentResolved.bind(this);
    }

    protected async onInit(): Promise<void> {
        this.logger.info('Analyst Hand initializing...');
        const globalConfig = loadConfig();

        this.llmGateway = new LLMGateway(globalConfig);

        this.aggregator = new IncidentAggregator();
        this.postmortemGenerator = new PostmortemGenerator(
            this.llmGateway,
            this.config.llm.model,
            this.config.llm.provider,
            this.id
        );
        this.graphBuilder = new KnowledgeGraphBuilder(
            this.llmGateway,
            this.config.llm.model,
            this.config.llm.provider,
            this.id
        );

        // Listen for resolved incidents
        eventBus.on('incident.resolved', this.boundIncidentResolvedHandler as any);

        this.logger.info('Analyst Hand initialization complete.');
    }

    protected async onExecute(): Promise<void> {
        // purely event-driven, but we emit a heartbeat
        this.logger.debug('Analyst Hand executing heartbeat...');
    }

    protected async onShutdown(): Promise<void> {
        this.logger.info('Analyst Hand shutting down...');
        eventBus.off('incident.resolved', this.boundIncidentResolvedHandler as any);
    }

    private async handleIncidentResolved(incident: Incident): Promise<void> {
        this.logger.info(`Received resolved incident event for ${incident.id}`);

        try {
            // 1. Aggregate Timeline & Context
            const context = await this.aggregator.aggregateContext(incident);

            // 2. Generate RCA Postmortem (Track Cost via LLMGateway internally)
            const postmortem = await this.postmortemGenerator.generatePostmortem(context);
            this.logger.info(`Generated postmortem for ${incident.id}`);

            // 3. Update Incident Record (in a real app, API/DB call)
            // We simulate saving back to the record by updating the object and optionally emitting an event
            incident.postmortem = postmortem;
            incident.status = IncidentStatus.POSTMORTEM;

            eventBus.emit('incident.updated', incident);

            // 4. Build Knowledge Graph
            const kgSummary = await this.graphBuilder.extractEntitiesAndSummary(context, postmortem);
            this.logger.info(`Generated Knowledge Graph summary for ${incident.id}:\n${kgSummary}`);

            // Knowledge graph data could similarly be persisted via API/DB to a runbook or KB.

        } catch (error) {
            this.logger.error(error, 'Failed to process incident resolution in Analyst Hand');
        }
    }
}

export { ANALYST_CONFIG };
