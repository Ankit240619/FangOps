// ============================================
// Sentinel Hand — Stub Entry Point
// Agent 2 (Sentinel Builder) will implement this
// ============================================

import { BaseHand, LLMProvider, RemediationTier, LLMGateway } from '@fangops/core';
import type { HandConfig } from '@fangops/core';
import { loadConfig } from '@fangops/core';
import { WebhookReceiver } from './ingestion/webhook-receiver.js';
import { PrometheusAdapter } from './ingestion/prometheus-adapter.js';
import { AlertCorrelationEngine } from './correlation/correlation-engine.js';
import { LLMAlertClassifier } from './classification/alert-classifier.js';
// Wait, we don't have direct LLM adapter imports, the server handles it or Sentinel can instantiate it. 
// Let's assume the API server initializes the global LLMGateway or we initialize a local one based on config.

const SENTINEL_CONFIG: HandConfig = {
    id: 'sentinel-001',
    name: 'sentinel',
    description: 'Monitors infrastructure, ingests alerts, correlates noise into actionable incidents',
    version: '0.1.0',
    tools: ['prometheus_query', 'webhook_receiver', 'alert_correlate', 'incident_create'],
    schedule: '*/1 * * * *', // every minute
    llm: {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o-mini',
        temperature: 0.1, // Low temp for consistent alert classification
    },
    budget: {
        dailyLimitUsd: 5.0,
        monthlyLimitUsd: 100.0,
    },
    remediationTier: RemediationTier.OBSERVE,
    settings: {
        correlationWindowSeconds: 300,
        minAlertsForCorrelation: 2,
        similarityThreshold: 0.7,
    },
};

/**
 * Sentinel Hand — Monitoring & Alert Correlation
 * 
 * Responsibilities:
 *   1. Ingest alerts from Prometheus, webhooks, CloudWatch
 *   2. Deduplicate and classify alerts using LLM
 *   3. Correlate related alerts into incident groups
 *   4. Emit events for Reporter and Dashboard to consume
 * 
 * TODO (Agent 2 will implement):
 *   - PrometheusAdapter: query /api/v1/alerts and /api/v1/query
 *   - WebhookReceiver: accept alerts via POST /api/v1/alerts/webhook
 *   - AlertCorrelationEngine: group related alerts by time + similarity
 *   - LLM classifier: severity assessment + root cause hypothesis
 */
export class SentinelHand extends BaseHand {
    private webhookReceiver!: WebhookReceiver;
    private prometheusAdapter!: PrometheusAdapter;
    private correlationEngine!: AlertCorrelationEngine;
    private llmClassifier!: LLMAlertClassifier;
    private llmGateway!: LLMGateway;

    constructor() {
        super(SENTINEL_CONFIG);
    }

    protected async onInit(): Promise<void> {
        this.logger.info('Sentinel Hand initializing — setting up ingestion adapters...');
        const globalConfig = loadConfig();

        // 1. Initialize Webhook Receiver
        this.webhookReceiver = new WebhookReceiver();
        this.webhookReceiver.start();

        // 2. Initialize Prometheus Adapter
        this.prometheusAdapter = new PrometheusAdapter(
            globalConfig.prometheusUrl || 'http://localhost:9090',
            30_000
        );
        this.prometheusAdapter.start();

        // 3. Initialize Correlation Engine
        this.correlationEngine = new AlertCorrelationEngine(
            this.config.settings['correlationWindowSeconds'] as number,
            this.config.settings['minAlertsForCorrelation'] as number,
            this.config.settings['similarityThreshold'] as number
        );
        this.correlationEngine.start();

        // 4. Initialize LLM Gateway for Classifier
        this.llmGateway = new LLMGateway(globalConfig);
        // Note: The global LLMGateway must have providers registered. If we assume the
        // main API server registers providers, the Hand might need to rely on a shared instance.
        // For standalone Hand execution, it needs its own providers but we'll use the core's default behavior.

        this.llmClassifier = new LLMAlertClassifier(
            this.llmGateway,
            this.config.llm.model,
            this.config.llm.provider,
            this.id
        );
        this.llmClassifier.start();

        this.logger.info('Sentinel Hand initialization complete.');
    }

    protected async onExecute(): Promise<void> {
        this.logger.info('Sentinel Hand executing heartbeat...');
        // The components are event-driven and run their own intervals, but we can use this 
        // to do sync sweeps if needed. For now, the event-driven Architecture handles the flow.
        this.correlationEngine.runCorrelationSweep();
    }

    protected async onShutdown(): Promise<void> {
        this.logger.info('Sentinel Hand shutting down...');
        this.webhookReceiver.stop();
        this.prometheusAdapter.stop();
        this.correlationEngine.stop();
        this.llmClassifier.stop();
        this.logger.info('Sentinel Hand shutdown complete.');
    }
}

export { SENTINEL_CONFIG };
