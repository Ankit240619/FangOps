import { z } from 'zod';
import { LLMProvider, RemediationTier } from '../types/index.js';

// ============================================
// FangOps Configuration Schema & Loader
// Validates all env vars at startup
// ============================================

const configSchema = z.object({
    // Server
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    apiPort: z.coerce.number().int().min(1).max(65535).default(3000),
    apiHost: z.string().default('0.0.0.0'),
    dashboardPort: z.coerce.number().int().min(1).max(65535).default(5173),

    // Database
    databaseUrl: z.string().min(1, 'DATABASE_URL is required'),

    // Auth
    jwtSecret: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    jwtExpiry: z.string().default('7d'),

    // LLM Providers
    openaiApiKey: z.string().optional(),
    anthropicApiKey: z.string().optional(),
    googleApiKey: z.string().optional(),
    ollamaBaseUrl: z.string().url().optional(),

    // LLM Budget
    llmDailyBudgetUsd: z.coerce.number().min(0).default(5.0),
    llmMonthlyBudgetUsd: z.coerce.number().min(0).default(100.0),
    llmDefaultProvider: z.nativeEnum(LLMProvider).default(LLMProvider.OPENAI),
    llmDefaultModel: z.string().default('gpt-4o-mini'),

    // Monitoring
    prometheusUrl: z.string().url().optional(),
    grafanaUrl: z.string().url().optional(),

    // Notifications
    slackBotToken: z.string().optional(),
    slackChannelId: z.string().optional(),
    telegramBotToken: z.string().optional(),
    telegramChatId: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.coerce.number().optional(),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional(),
    smtpFrom: z.string().email().optional(),

    // Remediation
    remediationDefaultTier: z.nativeEnum(RemediationTier).default(RemediationTier.OBSERVE),

    // OpenFang
    openfangBinaryPath: z.string().optional(),
    openfangApiUrl: z.string().url().optional(),
});

export type FangOpsConfig = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables.
 * Throws a descriptive error if validation fails.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): FangOpsConfig {
    const rawConfig = {
        nodeEnv: env['NODE_ENV'],
        apiPort: env['API_PORT'] || env['PORT'],
        apiHost: env['API_HOST'],
        dashboardPort: env['DASHBOARD_PORT'],
        databaseUrl: env['DATABASE_URL'] ?? 'file:./fangops.db',
        jwtSecret: env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
        jwtExpiry: env['JWT_EXPIRY'],
        openaiApiKey: env['OPENAI_API_KEY'] || undefined,
        anthropicApiKey: env['ANTHROPIC_API_KEY'] || undefined,
        googleApiKey: env['GOOGLE_GENERATIVE_AI_API_KEY'] || undefined,
        ollamaBaseUrl: env['OLLAMA_BASE_URL'] || undefined,
        llmDailyBudgetUsd: env['LLM_DAILY_BUDGET_USD'],
        llmMonthlyBudgetUsd: env['LLM_MONTHLY_BUDGET_USD'],
        llmDefaultProvider: env['LLM_DEFAULT_PROVIDER'],
        llmDefaultModel: env['LLM_DEFAULT_MODEL'],
        prometheusUrl: env['PROMETHEUS_URL'] || undefined,
        grafanaUrl: env['GRAFANA_URL'] || undefined,
        slackBotToken: env['SLACK_BOT_TOKEN'] || undefined,
        slackChannelId: env['SLACK_CHANNEL_ID'] || undefined,
        telegramBotToken: env['TELEGRAM_BOT_TOKEN'] || undefined,
        telegramChatId: env['TELEGRAM_CHAT_ID'] || undefined,
        smtpHost: env['SMTP_HOST'] || undefined,
        smtpPort: env['SMTP_PORT'],
        smtpUser: env['SMTP_USER'] || undefined,
        smtpPass: env['SMTP_PASS'] || undefined,
        smtpFrom: env['SMTP_FROM'] || undefined,
        remediationDefaultTier: env['REMEDIATION_DEFAULT_TIER'],
        openfangBinaryPath: env['OPENFANG_BINARY_PATH'] || undefined,
        openfangApiUrl: env['OPENFANG_API_URL'] || undefined,
    };

    const result = configSchema.safeParse(rawConfig);

    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(
            `FangOps configuration validation failed:\n${issues}\n\nCheck your .env file against .env.example`
        );
    }

    return result.data;
}

/**
 * Validate that at least one LLM provider is configured.
 */
export function validateLLMConfig(config: FangOpsConfig): void {
    const hasProvider =
        config.openaiApiKey ??
        config.anthropicApiKey ??
        config.googleApiKey ??
        config.ollamaBaseUrl;

    if (!hasProvider) {
        console.warn(
            'WARNING: No LLM provider configured. FangOps Hands will not be able to use AI capabilities.\n' +
            '   Set at least one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or OLLAMA_BASE_URL'
        );
    }
}

/**
 * Validate notification channel configuration.
 * Returns which channels are properly configured.
 */
export function getConfiguredChannels(config: FangOpsConfig): string[] {
    const channels: string[] = [];
    if (config.slackBotToken && config.slackChannelId) channels.push('slack');
    if (config.telegramBotToken && config.telegramChatId) channels.push('telegram');
    if (config.smtpHost && config.smtpFrom) channels.push('email');
    return channels;
}
