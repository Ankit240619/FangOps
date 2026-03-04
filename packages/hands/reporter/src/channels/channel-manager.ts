import type { Notification } from '@fangops/core';
import { NotificationChannel, EventBus, eventBus } from '@fangops/core';
import { SlackAdapter } from './slack-adapter.js';
import { TelegramAdapter } from './telegram-adapter.js';
import { EmailAdapter } from './email-adapter.js';

export interface ChannelManagerConfig {
    slack?: { token: string; defaultChannelId: string };
    telegram?: { token: string; defaultChatId: string };
    email?: { host: string; port: number; user: string; pass: string; fromAddress: string; defaultToAddress: string };
}

export class ChannelManager {
    private slackAdapter?: SlackAdapter;
    private telegramAdapter?: TelegramAdapter;
    private emailAdapter?: EmailAdapter;
    private eventBus: EventBus;
    private readonly MAX_RETRIES = 3;

    constructor(config: ChannelManagerConfig) {
        this.eventBus = eventBus;

        if (config.slack) {
            this.slackAdapter = new SlackAdapter(config.slack.token, config.slack.defaultChannelId);
        }

        if (config.telegram) {
            this.telegramAdapter = new TelegramAdapter(config.telegram.token, config.telegram.defaultChatId);
        }

        if (config.email) {
            this.emailAdapter = new EmailAdapter(config.email);
        }
    }

    async sendNotification(notification: Notification): Promise<void> {
        let retries = 0;
        let lastError: Error | null = null;

        while (retries <= this.MAX_RETRIES) {
            try {
                await this.dispatch(notification);

                // On success, emit event and break out of retry loop
                this.eventBus.emit('notification.sent', {
                    ...notification,
                    status: 'sent',
                    sentAt: new Date()
                });
                return;

            } catch (error: any) {
                lastError = error;
                retries++;

                if (retries <= this.MAX_RETRIES) {
                    // Exponential backoff: 1s, 2s, 4s...
                    const delay = Math.pow(2, retries - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // If we exhausted retries, emit failure
        this.eventBus.emit('notification.failed', {
            ...notification,
            status: 'failed',
            error: lastError?.message || 'Unknown error'
        });

        // Throw the error so the caller knows it failed
        throw new Error(`Failed to send notification after ${this.MAX_RETRIES} retries: ${lastError?.message}`);
    }

    private async dispatch(notification: Notification): Promise<void> {
        switch (notification.channel) {
            case NotificationChannel.SLACK:
                if (!this.slackAdapter) throw new Error('Slack adapter not configured');
                await this.slackAdapter.send(notification);
                break;

            case NotificationChannel.TELEGRAM:
                if (!this.telegramAdapter) throw new Error('Telegram adapter not configured');
                await this.telegramAdapter.send(notification);
                break;

            case NotificationChannel.EMAIL:
                if (!this.emailAdapter) throw new Error('Email adapter not configured');
                await this.emailAdapter.send(notification);
                break;

            default:
                throw new Error(`Unsupported channel: ${notification.channel}`);
        }
    }
}
