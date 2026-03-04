import { BaseHand } from '../abstraction/hand-runtime';
import type { HandConfig } from '../types';

export class MockHand extends BaseHand {
    constructor(config: HandConfig) {
        super(config);
    }

    protected async onInit(): Promise<void> {
        // Mock initialization
    }

    protected async onExecute(): Promise<void> {
        // Mock execute
    }

    protected async onShutdown(): Promise<void> {
        // Mock shutdown
    }
}
