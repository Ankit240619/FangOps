import type { Notification } from '@fangops/core';
import { NotificationChannel } from '@fangops/core';

export class TelegramAdapter {
    private botToken: string;
    private defaultChatId: string;
    private lastMessageTime = 0;
    private readonly RATE_LIMIT_MS = 34; // Approx 30 messages per second

    constructor(token: string, defaultChatId: string) {
        if (!token) throw new Error('Telegram token is required');
        this.botToken = token;
        this.defaultChatId = defaultChatId;
    }

    async send(notification: Notification): Promise<void> {
        if (notification.channel !== NotificationChannel.TELEGRAM) {
            throw new Error(`TelegramAdapter cannot handle channel: ${notification.channel}`);
        }

        await this.enforceRateLimit();

        const chatId = notification.recipient || this.defaultChatId;
        const text = (notification.richBody as string) || notification.body;

        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'MarkdownV2',
                    disable_web_page_preview: true
                })
            });

            if (!response.ok) {
                const errorData = await response.json() as any;
                throw new Error(errorData.description || 'Unknown Telegram API error');
            }
        } catch (error: any) {
            throw new Error(`Failed to send Telegram message: ${error.message}`);
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
