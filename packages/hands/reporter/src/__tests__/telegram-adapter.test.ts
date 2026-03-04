import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramAdapter } from '../channels/telegram-adapter.js';
import { type Notification, NotificationChannel } from '@fangops/core';

describe('TelegramAdapter', () => {
    beforeEach(() => {
        // Reset global fetch mock
        global.fetch = vi.fn();
    });

    it('should send a markdown message via fetch', async () => {
        const adapter = new TelegramAdapter('bot-token', 'chat-id');
        (adapter as any).RATE_LIMIT_MS = 0; // Disable rate limit wait for tests

        const mockFetch = vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ok: true })
        } as any);

        const notification: Notification = {
            id: '1',
            channel: NotificationChannel.TELEGRAM,
            type: 'system',
            title: 'Test',
            body: 'Test Body',
            recipient: 'custom-chat',
            status: 'pending',
            createdAt: new Date()
        };

        await adapter.send(notification);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.telegram.org/botbot-token/sendMessage',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    chat_id: 'custom-chat',
                    text: 'Test Body',
                    parse_mode: 'MarkdownV2',
                    disable_web_page_preview: true
                })
            })
        );
    });

    it('should throw an error if the Telegram API responds with an error', async () => {
        const adapter = new TelegramAdapter('bot-token', 'chat-id');
        (adapter as any).RATE_LIMIT_MS = 0;

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ ok: false, description: 'Bad Request: chat not found' })
        } as any);

        const notification: Notification = {
            id: '2',
            channel: NotificationChannel.TELEGRAM,
            type: 'system',
            title: '',
            body: 'Hello',
            recipient: '',
            status: 'pending',
            createdAt: new Date()
        };

        await expect(adapter.send(notification)).rejects.toThrow(/Bad Request: chat not found/);
    });
});
