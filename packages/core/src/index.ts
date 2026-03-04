// ============================================
// FangOps Core — Public API
// Single import point for all core functionality
// ============================================

// Types — the contract all components build against
export * from './types/index.js';

// Configuration — validated config loader
export { loadConfig, validateLLMConfig, getConfiguredChannels } from './config/index.js';
export type { FangOpsConfig } from './config/index.js';

// Event Bus — typed pub/sub for inter-component communication
export { EventBus, eventBus } from './events/index.js';

// Logger — structured logging
export { createLogger, getRootLogger, loggers } from './logger/index.js';
export type { LogContext } from './logger/index.js';

// Abstraction Layer — Hand runtime & LLM gateway
export { BaseHand, HandRegistry } from './abstraction/hand-runtime.js';
export { LLMGateway, LLMProviderAdapter, estimateCost } from './abstraction/llm-gateway.js';
