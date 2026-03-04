import {
    BaseHand,
    LLMProvider,
    RemediationTier,
    NotificationChannel
} from '@fangops/core';
import type { HandConfig, Notification, CorrelatedAlertGroup, Incident, RemediationAction } from '@fangops/core';
import { ChannelManager } from './channels/channel-manager.js';
import { SummaryGenerator } from './generator/summary-generator.js';
import { formatAlertForSlack, formatAlertForTelegram, formatAlertForEmail } from './templates/alert-template.js';
import { formatIncidentForSlack, formatIncidentForTelegram, formatIncidentForEmail } from './templates/incident-template.js';
import { formatApprovalForSlack, formatApprovalForTelegram, formatApprovalForEmail } from './templates/approval-template.js';
import { formatSummaryForSlack, formatSummaryForTelegram, formatSummaryForEmail } from './templates/summary-template.js';
import { nanoid } from 'nanoid';
// Notice we mock LLMGateway since it's typically injected by the Orchestrator, but we need it for SummaryGenerator
import { LLMGateway } from '@fangops/core';

const REPORTER_CONFIG: HandConfig = {
    id: 'reporter-001',
    name: 'reporter',
    description: 'Generates daily health summaries, incident updates, and SLA reports. Delivers via Slack, Telegram, Email.',
    version: '0.1.0',
    tools: ['send_slack', 'send_telegram', 'send_email', 'generate_summary'],
    schedule: '0 8 * * *', // daily at 8 AM
    llm: {
        provider: LLMProvider.OPENAI,
        model: 'gpt-4o-mini',
        temperature: 0.3,
    },
    budget: {
        dailyLimitUsd: 2.0,
        monthlyLimitUsd: 50.0,
    },
    remediationTier: RemediationTier.OBSERVE,
    settings: {
        summarySchedule: '0 8 * * *', // 8 AM daily
        channels: ['slack', 'email', 'telegram'],
    },
};

export class ReporterHand extends BaseHand {
    private channelManager!: ChannelManager;
    private summaryGenerator!: SummaryGenerator;

    constructor() {
        super(REPORTER_CONFIG);
    }

    protected async onInit(): Promise<void> {
        this.logger.info('Reporter Hand initializing — setting up notification channels...');

        // In a real environment, these would come from process.env or secret manager
        const slackToken = process.env.SLACK_BOT_TOKEN;
        const slackChannelId = process.env.SLACK_CHANNEL_ID;
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        const smtpHost = process.env.SMTP_HOST;

        const channelConfig: any = {};

        if (slackToken && slackChannelId) {
            channelConfig.slack = { token: slackToken, defaultChannelId: slackChannelId };
        }

        if (telegramToken && telegramChatId) {
            channelConfig.telegram = { token: telegramToken, defaultChatId: telegramChatId };
        }

        if (smtpHost) {
            channelConfig.email = {
                host: smtpHost,
                port: parseInt(process.env.SMTP_PORT || '587'),
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || '',
                fromAddress: process.env.SMTP_FROM || 'fangops@example.com',
                defaultToAddress: process.env.SMTP_TO || 'admin@example.com'
            };
        }

        this.channelManager = new ChannelManager(channelConfig);

        // Instantiate a mock/dummy gateway if not provided. In complete system, this would be injected.
        // For the sake of Agent 4 task, we assume a local gateway instance.
        const mockGateway = new LLMGateway({} as any);
        this.summaryGenerator = new SummaryGenerator(mockGateway, this.id);

        this.subscribeToEvents();
    }

    private subscribeToEvents(): void {
        this.eventBus.on('alert.correlated', async (group: CorrelatedAlertGroup) => {
            this.logger.info(`Sending alert notification for group ${group.correlationId}`);

            // For each alert in the correlated group, we might send an alert notification
            // or just notify about the whole group. But the requirements say `alert.correlated -> send alert notification`
            const representativeAlert = group.alerts[0]; // simplistic approach
            if (!representativeAlert) return;
            representativeAlert.title = group.title;
            representativeAlert.description = group.summary;

            await this.broadcastNotification({
                type: 'alert',
                slackRich: formatAlertForSlack(representativeAlert),
                telegramStr: formatAlertForTelegram(representativeAlert),
                emailHtml: formatAlertForEmail(representativeAlert),
                fallbackBody: representativeAlert.title
            });
        });

        this.eventBus.on('incident.created', async (incident: Incident) => {
            this.logger.info(`Sending incident created notification for ${incident.id}`);
            await this.broadcastNotification({
                type: 'incident',
                title: `Incident Opened: ${incident.title}`,
                slackRich: formatIncidentForSlack(incident),
                telegramStr: formatIncidentForTelegram(incident),
                emailHtml: formatIncidentForEmail(incident),
                fallbackBody: incident.title
            });
        });

        this.eventBus.on('incident.resolved', async (incident: Incident) => {
            this.logger.info(`Sending incident resolved notification for ${incident.id}`);
            await this.broadcastNotification({
                type: 'incident',
                title: `Incident Resolved: ${incident.title}`,
                slackRich: formatIncidentForSlack(incident),
                telegramStr: formatIncidentForTelegram(incident),
                emailHtml: formatIncidentForEmail(incident),
                fallbackBody: incident.title
            });
        });

        this.eventBus.on('remediation.proposed', async (action: RemediationAction) => {
            this.logger.info(`Sending approval request for remediation action ${action.id}`);
            await this.broadcastNotification({
                type: 'approval_request',
                title: `Approval Required: ${action.action}`,
                slackRich: formatApprovalForSlack(action),
                telegramStr: formatApprovalForTelegram(action),
                emailHtml: formatApprovalForEmail(action),
                fallbackBody: `Approval required for action: ${action.action}`
            });
        });
    }

    private async broadcastNotification(content: {
        type: 'alert' | 'incident' | 'summary' | 'approval_request' | 'system';
        title?: string;
        slackRich: any;
        telegramStr: string;
        emailHtml: string;
        fallbackBody: string;
    }): Promise<void> {
        const configuredChannels = this.config.settings.channels as NotificationChannel[];

        for (const channel of configuredChannels) {
            const notification: Notification = {
                id: nanoid(12),
                channel,
                type: content.type,
                title: content.title || content.fallbackBody,
                body: content.fallbackBody,
                recipient: '', // Let adapter handle default
                status: 'pending',
                createdAt: new Date()
            };

            switch (channel) {
                case NotificationChannel.SLACK:
                    notification.richBody = content.slackRich;
                    break;
                case NotificationChannel.TELEGRAM:
                    notification.richBody = content.telegramStr;
                    break;
                case NotificationChannel.EMAIL:
                    notification.richBody = content.emailHtml;
                    break;
            }

            try {
                await this.channelManager.sendNotification(notification);
            } catch (err: any) {
                this.logger.warn({ err }, `Failed to send ${content.type} notification to ${channel}`);
            }
        }
    }

    protected async onExecute(): Promise<void> {
        this.logger.info('Reporter Hand executing — generating daily summary...');

        try {
            // In a real system, we'd query metrics DB. Mocking for now.
            const metrics = {
                totalAlerts: 42,
                criticalAlerts: 3,
                resolvedAlerts: 39,
                activeIncidents: 1,
                resolvedIncidents: 2,
                mttrMinutes: 45,
                remediationActionsCount: 5,
                topIssues: [],
                llmCostUsd: 1.25,
                handStatuses: [
                    { handId: 'sentinel', name: 'Sentinel', status: 'running' as any }
                ]
            };

            const summary = await this.summaryGenerator.generate(new Date(), metrics);

            // Track cost if LLM was used (mocked 0.01 for example purposes)
            this.trackCost(0.01);

            await this.broadcastNotification({
                type: 'summary',
                title: 'Daily Health Summary',
                slackRich: formatSummaryForSlack(summary),
                telegramStr: formatSummaryForTelegram(summary),
                emailHtml: formatSummaryForEmail(summary),
                fallbackBody: summary.narrative
            });

        } catch (error: any) {
            this.logger.error({ err: error }, 'Failed to generate daily summary');
        }
    }

    protected async onShutdown(): Promise<void> {
        this.logger.info('Reporter Hand shutting down...');
    }
}

export { REPORTER_CONFIG };

