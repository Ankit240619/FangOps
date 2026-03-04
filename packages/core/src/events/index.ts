import { EventEmitter } from 'node:events';
import type { FangOpsEventMap } from '../types/index.js';

// ============================================
// FangOps Event Bus
// Typed pub/sub for inter-component communication
// ============================================

type EventName = keyof FangOpsEventMap;
type EventHandler<T extends EventName> = (payload: FangOpsEventMap[T]) => void | Promise<void>;

/**
 * Typed event bus for FangOps.
 * All inter-component communication goes through this bus.
 * 
 * Usage:
 *   const bus = EventBus.getInstance();
 *   bus.on('alert.received', (alert) => { ... });
 *   bus.emit('alert.received', alertData);
 */
export class EventBus {
    private static instance: EventBus | null = null;
    private emitter: EventEmitter;

    private constructor() {
        this.emitter = new EventEmitter();
        this.emitter.setMaxListeners(100); // support many subscribers
    }

    /** Get the singleton event bus instance */
    static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    /** Reset the singleton (for testing) */
    static resetInstance(): void {
        if (EventBus.instance) {
            EventBus.instance.emitter.removeAllListeners();
            EventBus.instance = null;
        }
    }

    /** Subscribe to an event */
    on<T extends EventName>(event: T, handler: EventHandler<T>): void {
        this.emitter.on(event, handler as (...args: unknown[]) => void);
    }

    /** Subscribe to an event (fires only once) */
    once<T extends EventName>(event: T, handler: EventHandler<T>): void {
        this.emitter.once(event, handler as (...args: unknown[]) => void);
    }

    /** Unsubscribe from an event */
    off<T extends EventName>(event: T, handler: EventHandler<T>): void {
        this.emitter.off(event, handler as (...args: unknown[]) => void);
    }

    /** Emit an event with typed payload */
    emit<T extends EventName>(event: T, payload: FangOpsEventMap[T]): void {
        this.emitter.emit(event, payload);
    }

    /** Get count of listeners for an event */
    listenerCount(event: EventName): number {
        return this.emitter.listenerCount(event);
    }

    /** Remove all listeners (for cleanup/testing) */
    removeAllListeners(event?: EventName): void {
        if (event) {
            this.emitter.removeAllListeners(event);
        } else {
            this.emitter.removeAllListeners();
        }
    }

    /** Wait for a specific event (Promise-based) */
    waitFor<T extends EventName>(
        event: T,
        timeoutMs = 30000
    ): Promise<FangOpsEventMap[T]> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`EventBus.waitFor('${event}') timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            this.once(event, (payload) => {
                clearTimeout(timer);
                resolve(payload);
            });
        });
    }
}

/** Convenience export for quick access */
export const eventBus = EventBus.getInstance();
