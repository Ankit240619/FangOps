import { CronJob } from 'cron';
import { nanoid } from 'nanoid';
import type { HandConfig, HandRunState } from '../types/index.js';
import { HandStatus } from '../types/index.js';
import { EventBus } from '../events/index.js';
import { createLogger } from '../logger/index.js';

// ============================================
// FangOps Hand Runtime — Abstraction Layer
// Manages Hand lifecycle independently of OpenFang
// ============================================

/**
 * Base class for all FangOps Hands.
 * Extend this to create custom Hands (Sentinel, Reporter, Resolver, Analyst).
 * 
 * The abstraction layer means:
 *  - Hands run as pure TypeScript when OpenFang is unavailable
 *  - When OpenFang is stable, we can plug into its HAND.toml lifecycle
 *  - This protects against OpenFang v0.1.0 instability
 */
export abstract class BaseHand {
    readonly id: string;
    readonly config: HandConfig;
    protected state: HandRunState;
    protected logger;
    protected eventBus: EventBus;
    private cronJob: CronJob | null = null;

    constructor(config: HandConfig) {
        this.id = config.id || nanoid(12);
        this.config = config;
        this.eventBus = EventBus.getInstance();
        this.logger = createLogger({
            handId: this.id,
            handName: config.name,
        });

        this.state = {
            handId: this.id,
            status: HandStatus.INITIALIZING,
            startedAt: new Date(),
            lastHeartbeat: new Date(),
            totalCostUsd: 0,
            executionCount: 0,
            errorCount: 0,
        };
    }

    /** Override: Initialize hand-specific resources */
    protected abstract onInit(): Promise<void>;

    /** Override: Execute one cycle of the hand's work */
    protected abstract onExecute(): Promise<void>;

    /** Override: Cleanup hand-specific resources */
    protected abstract onShutdown(): Promise<void>;

    /** Start the hand */
    async start(): Promise<void> {
        try {
            this.logger.info(`Starting hand: ${this.config.name}`);
            this.updateStatus(HandStatus.INITIALIZING);

            await this.onInit();

            this.updateStatus(HandStatus.RUNNING);
            this.eventBus.emit('hand.started', { ...this.state });

            // Set up scheduled execution if configured
            if (this.config.schedule) {
                this.cronJob = CronJob.from({
                    cronTime: this.config.schedule,
                    onTick: () => void this.executeWithErrorHandling(),
                    start: true,
                });
                this.logger.info(`Scheduled execution: ${this.config.schedule}`);
            } else {
                // Run once immediately if no schedule
                await this.executeWithErrorHandling();
            }

            // Start heartbeat
            this.startHeartbeat();
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    /** Stop the hand gracefully */
    async stop(): Promise<void> {
        this.logger.info(`Stopping hand: ${this.config.name}`);

        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        try {
            await this.onShutdown();
        } catch (error) {
            this.logger.error({ err: error }, 'Error during shutdown');
        }

        this.updateStatus(HandStatus.STOPPED);
        this.eventBus.emit('hand.stopped', { ...this.state });
    }

    /** Pause the hand (stop scheduled executions) */
    pause(): void {
        if (this.cronJob) {
            this.cronJob.stop();
        }
        this.updateStatus(HandStatus.PAUSED);
        this.logger.info('Hand paused');
    }

    /** Resume a paused hand */
    resume(): void {
        if (this.cronJob) {
            this.cronJob.start();
        }
        this.updateStatus(HandStatus.RUNNING);
        this.logger.info('Hand resumed');
    }

    /** Get current state */
    getState(): Readonly<HandRunState> {
        return { ...this.state };
    }

    /** Track LLM cost for budget enforcement */
    protected trackCost(costUsd: number): void {
        this.state.totalCostUsd += costUsd;

        // Check daily budget
        if (this.state.totalCostUsd >= this.config.budget.dailyLimitUsd) {
            this.logger.warn(
                { currentCost: this.state.totalCostUsd, limit: this.config.budget.dailyLimitUsd },
                'Daily budget limit reached — pausing hand'
            );
            this.eventBus.emit('llm.budget_warning', {
                handId: this.id,
                currentCostUsd: this.state.totalCostUsd,
                limitUsd: this.config.budget.dailyLimitUsd,
            });
            this.pause();
        }
    }

    private async executeWithErrorHandling(): Promise<void> {
        try {
            this.state.executionCount++;
            this.logger.debug(`Execution #${this.state.executionCount}`);
            await this.onExecute();
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    private handleError(error: Error): void {
        this.state.errorCount++;
        this.state.lastError = error.message;
        this.logger.error({ err: error }, 'Hand execution error');

        // Don't crash on error — mark as ERROR but keep running
        if (this.state.errorCount >= 5) {
            this.updateStatus(HandStatus.ERROR);
            this.eventBus.emit('hand.error', { ...this.state, error });
            this.logger.error('Too many consecutive errors — hand entering ERROR state');
        }
    }

    private updateStatus(status: HandStatus): void {
        this.state.status = status;
        this.state.lastHeartbeat = new Date();
    }

    private startHeartbeat(): void {
        // Emit heartbeat every 30 seconds
        const interval = setInterval(() => {
            if (this.state.status === HandStatus.RUNNING) {
                this.state.lastHeartbeat = new Date();
                this.eventBus.emit('hand.heartbeat', { ...this.state });
            }
        }, 30_000);

        // Allow the process to exit even if heartbeat is running
        if (typeof interval === 'object' && 'unref' in interval) {
            interval.unref();
        }
    }
}

// ============================================
// Hand Registry — Discover & manage all Hands
// ============================================

export class HandRegistry {
    private hands = new Map<string, BaseHand>();
    private logger = createLogger({ component: 'hand-registry' });

    /** Register a hand instance */
    register(hand: BaseHand): void {
        if (this.hands.has(hand.id)) {
            throw new Error(`Hand with ID "${hand.id}" is already registered`);
        }
        this.hands.set(hand.id, hand);
        this.logger.info({ handId: hand.id, name: hand.config.name }, 'Hand registered');
    }

    /** Unregister a hand */
    unregister(handId: string): void {
        this.hands.delete(handId);
        this.logger.info({ handId }, 'Hand unregistered');
    }

    /** Get a hand by ID */
    get(handId: string): BaseHand | undefined {
        return this.hands.get(handId);
    }

    /** Get all registered hands */
    getAll(): BaseHand[] {
        return Array.from(this.hands.values());
    }

    /** Get all hand states */
    getAllStates(): HandRunState[] {
        return this.getAll().map((hand) => hand.getState());
    }

    /** Start all registered hands */
    async startAll(): Promise<void> {
        this.logger.info(`Starting ${this.hands.size} hands...`);
        const startPromises = this.getAll().map((hand) => hand.start());
        await Promise.allSettled(startPromises);
    }

    /** Stop all registered hands */
    async stopAll(): Promise<void> {
        this.logger.info(`Stopping ${this.hands.size} hands...`);
        const stopPromises = this.getAll().map((hand) => hand.stop());
        await Promise.allSettled(stopPromises);
    }
}
