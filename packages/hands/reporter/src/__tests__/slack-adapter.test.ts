import { describe, it, expect, vi } from 'vitest';
import { SlackAdapter } from '../channels/slack-adapter.js';
import { WebClient } from '@slack/web-api';
import { type Notification, NotificationChannel } from '@fangops/core';

// Mock the external Slack client
vi.mock('@slack/web-api', () => {
    return {
        WebClient: vi.fn().mockImplementation(() => {
            return {
                chat: {
                    postMessage: vi.fn().mockResolvedValue({ ok: true })
                }
            };
        })
    };
});

describe('SlackAdapter', () => {
    it('should send a message using WebClient', async () => {
        const adapter = new SlackAdapter('test-token', 'default-channel');

        // Disable rate limits for testing fast
        (adapter as any).RATE_LIMIT_MS = 0;

        const notification: Notification = {
            id: '1',
            channel: NotificationChannel.SLACK,
            type: 'system',
            title: 'Test',
            body: 'Hello World',
            recipient: 'C12345',
            status: 'pending',
            createdAt: new Date()
        };

        await adapter.send(notification);

        const mockClient = (adapter as any).client as WebClient;
        expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
            channel: 'C12345',
            text: 'Hello World' // body takes precedence over title when blocks are missing
        });
    });

    it('should throw error for unsupported channels', async () => {
        const adapter = new SlackAdapter('test-token', 'default-channel');

        const notification: Notification = {
            id: '2',
            channel: NotificationChannel.EMAIL, // Invalid for this adapter
            type: 'system',
            title: 'Test',
            body: 'Hello',
            recipient: '',
            status: 'pending',
            createdAt: new Date()
        };

        await expect(adapter.send(notification)).rejects.toThrow(/SlackAdapter cannot handle channel/);
    });
});
