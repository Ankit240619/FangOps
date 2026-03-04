import { vi } from 'vitest';

export const createMockEventBus = () => {
    return {
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        listenerCount: vi.fn(),
        removeAllListeners: vi.fn(),
        waitFor: vi.fn()
    };
};
