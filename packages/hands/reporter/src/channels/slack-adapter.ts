import { WebClient } from '@slack/web-api';
import type { Notification } from '@fangops/core';
import { NotificationChannel } from '@fangops/core';

export class SlackAdapter {
    private client: WebClient;
    private defaultChannelId: string;
    private lastMessageTime = 0;
    private readonly RATE_LIMIT_MS = 1000; // 1 message per second

    constructor(token: string, defaultChannelId: string) {
        if (!token) throw new Error('Slack token is required');
        this.client = new WebClient(token);
        this.defaultChannelId = defaultChannelId;
    }

    async send(notification: Notification): Promise<void> {
        if (notification.channel !== NotificationChannel.SLACK) {
            throw new Error(`SlackAdapter cannot handle channel: ${notification.channel}`);
        }

        await this.enforceRateLimit();

        const channel = notification.recipient || this.defaultChannelId;
        const blocks = notification.richBody as any[];

        try {
            if (blocks && Array.isArray(blocks)) {
                await this.client.chat.postMessage({
                    channel,
                    text: notification.title || notification.body,
                    blocks
                });
            } else {
                await this.client.chat.postMessage({
                    channel,
                    text: notification.body || notification.title
                });
            }
        } catch (error: any) {
            throw new Error(`Failed to send Slack message: ${error.message}`);
        }
    }

    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastMessage = now - this.lastMessageTime;

        if (timeSinceLastMessage < this.RATE_LIMIT_MS) {
            const delay = this.RATE_LIMIT_MS - timeSinceLastMessage;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastMessageTime = Date.now();
    }
}
