import { nanoid } from 'nanoid';
import type { LLMRequest, LLMResponse, LLMCostEntry, LLMProvider } from '../types/index.js';
import { EventBus } from '../events/index.js';
import { createLogger } from '../logger/index.js';
import type { FangOpsConfig } from '../config/index.js';

// ============================================
// FangOps LLM Gateway — Unified LLM Interface
// Handles routing, fallback, cost tracking, budgets
// ============================================

/** Cost per 1M tokens (approximate, as of early 2026) */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'claude-3.5-haiku': { input: 0.80, output: 4.00 },
    'gemini-2.0-flash': { input: 0.075, output: 0.30 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    // Local models are free
    'ollama/*': { input: 0, output: 0 },
};

/**
 * Abstract LLM provider adapter.
 * Implementations for each provider (OpenAI, Anthropic, etc.) extend this.
 */
export abstract class LLMProviderAdapter {
    abstract readonly provider: LLMProvider;
    abstract readonly name: string;

    /** Check if this provider is configured and ready */
    abstract isAvailable(): boolean;

    /** Send a completion request to this provider */
    abstract complete(request: LLMRequest): Promise<LLMResponse>;
}

/**
 * LLM Gateway — the single entry point for all LLM calls across FangOps.
 * 
 * Features:
 *  - Unified interface regardless of provider
 *  - Automatic fallback if primary provider fails
 *  - Cost tracking per request, per hand, per day
 *  - Budget enforcement (daily + monthly)
 *  - Full audit log emitted via event bus
 */
export class LLMGateway {
    private providers = new Map<string, LLMProviderAdapter>();
    private costLog: LLMCostEntry[] = [];
    private dailyCostUsd = 0;
    private monthlyCostUsd = 0;
    private lastDayReset: string = '';
    private lastMonthReset: string = '';
    private logger = createLogger({ component: 'llm-gateway' });
    private eventBus = EventBus.getInstance();

    constructor(private config: FangOpsConfig) { }

    /** Register a provider adapter */
    registerProvider(adapter: LLMProviderAdapter): void {
        if (!adapter.isAvailable()) {
            this.logger.warn(`LLM provider ${adapter.name} registered but NOT available (missing API key?)`);
        }
        this.providers.set(adapter.provider, adapter);
        this.logger.info(`LLM provider registered: ${adapter.name} (available: ${adapter.isAvailable()})`);
    }

    /** Get all registered providers */
    getProviders(): Array<{ provider: string; name: string; available: boolean }> {
        return Array.from(this.providers.values()).map((p) => ({
            provider: p.provider,
            name: p.name,
            available: p.isAvailable(),
        }));
    }

    /**
     * Send a completion request with automatic provider fallback.
     * 
     * @throws Error if no providers are available or budget is exceeded
     */
    async complete(request: Omit<LLMRequest, 'requestId'>): Promise<LLMResponse> {
        const requestId = nanoid(16);
        const fullRequest: LLMRequest = { ...request, requestId };

        // Budget check
        this.resetBudgetCountersIfNeeded();
        if (this.dailyCostUsd >= this.config.llmDailyBudgetUsd) {
            throw new Error(
                `Daily LLM budget exceeded: $${this.dailyCostUsd.toFixed(2)} / $${this.config.llmDailyBudgetUsd.toFixed(2)}`
            );
        }
        if (this.monthlyCostUsd >= this.config.llmMonthlyBudgetUsd) {
            throw new Error(
                `Monthly LLM budget exceeded: $${this.monthlyCostUsd.toFixed(2)} / $${this.config.llmMonthlyBudgetUsd.toFixed(2)}`
            );
        }

        this.eventBus.emit('llm.request', fullRequest);

        // Try primary provider
        const primaryProvider = this.providers.get(request.provider);
        if (primaryProvider?.isAvailable()) {
            try {
                const response = await primaryProvider.complete(fullRequest);
                this.trackCost(response, fullRequest.handId);
                this.eventBus.emit('llm.response', response);
                return response;
            } catch (error) {
                this.logger.warn(
                    { err: error, provider: request.provider },
                    'Primary provider failed, trying fallbacks...'
                );
            }
        }

        // Try fallback providers
        for (const [providerKey, adapter] of this.providers) {
            if (providerKey === request.provider) continue;
            if (!adapter.isAvailable()) continue;

            try {
                this.logger.info(`Falling back to provider: ${adapter.name}`);
                const fallbackRequest: LLMRequest = {
                    ...fullRequest,
                    provider: adapter.provider as LLMRequest['provider'],
                };
                const response = await adapter.complete(fallbackRequest);
                this.trackCost(response, fullRequest.handId);
                this.eventBus.emit('llm.response', response);
                return response;
            } catch (error) {
                this.logger.warn({ err: error, provider: providerKey }, 'Fallback provider failed');
            }
        }

        throw new Error('All LLM providers failed. Check API keys and provider availability.');
    }

    /** Get cost summary */
    getCostSummary(): {
        dailyCostUsd: number;
        monthlyCostUsd: number;
        dailyLimitUsd: number;
        monthlyLimitUsd: number;
        recentCosts: LLMCostEntry[];
    } {
        return {
            dailyCostUsd: this.dailyCostUsd,
            monthlyCostUsd: this.monthlyCostUsd,
            dailyLimitUsd: this.config.llmDailyBudgetUsd,
            monthlyLimitUsd: this.config.llmMonthlyBudgetUsd,
            recentCosts: this.costLog.slice(-50), // last 50 entries
        };
    }

    private trackCost(response: LLMResponse, handId?: string): void {
        const entry: LLMCostEntry = {
            requestId: response.requestId,
            handId,
            provider: response.provider,
            model: response.model,
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            costUsd: response.costUsd,
            timestamp: new Date(),
        };

        this.costLog.push(entry);
        this.dailyCostUsd += response.costUsd;
        this.monthlyCostUsd += response.costUsd;

        this.logger.debug(
            {
                model: response.model,
                tokens: response.usage.totalTokens,
                cost: `$${response.costUsd.toFixed(4)}`,
                dailyTotal: `$${this.dailyCostUsd.toFixed(2)}`,
            },
            'LLM cost tracked'
        );

        // Warn at 80% budget
        if (this.dailyCostUsd >= this.config.llmDailyBudgetUsd * 0.8) {
            this.eventBus.emit('llm.budget_warning', {
                handId,
                currentCostUsd: this.dailyCostUsd,
                limitUsd: this.config.llmDailyBudgetUsd,
            });
        }
    }

    private resetBudgetCountersIfNeeded(): void {
        const today = new Date().toISOString().slice(0, 10);
        const thisMonth = new Date().toISOString().slice(0, 7);

        if (today !== this.lastDayReset) {
            this.dailyCostUsd = 0;
            this.lastDayReset = today;
        }
        if (thisMonth !== this.lastMonthReset) {
            this.monthlyCostUsd = 0;
            this.lastMonthReset = thisMonth;
        }
    }
}

/**
 * Estimate cost for a completion based on model pricing.
 */
export function estimateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
): number {
    const pricing = MODEL_COSTS[model];
    if (!pricing) {
        // Unknown model — estimate conservatively
        return ((promptTokens * 1.0 + completionTokens * 3.0) / 1_000_000);
    }
    return (
        (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000
    );
}
