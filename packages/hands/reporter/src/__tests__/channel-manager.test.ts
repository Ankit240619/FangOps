import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelManager } from '../channels/channel-manager.js';
import { NotificationChannel, type Notification } from '@fangops/core';
import { eventBus } from '@fangops/core';

describe('ChannelManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        eventBus.removeAllListeners();
    });

    it('should initialize successfully without adapters if config is empty', () => {
        const manager = new ChannelManager({});
        expect(manager).toBeDefined();
    });

    it('should dispatch to the correct adapter', async () => {
        const manager = new ChannelManager({
            slack: { token: 'mock', defaultChannelId: 'mock' }
        });

        // We mock the inner SlackAdapter's send method
        const slackSendSpy = vi.spyOn((manager as any).slackAdapter, 'send').mockResolvedValue(undefined);

        const notification: Notification = {
            id: 'test-n-1',
            channel: NotificationChannel.SLACK,
            type: 'alert',
            title: 'Test',
            body: 'Test body',
            recipient: '',
            status: 'pending',
            createdAt: new Date()
        };

        const emitSpy = vi.spyOn(eventBus, 'emit');

        await manager.sendNotification(notification);

        // Expect adapter send was called
        expect(slackSendSpy).toHaveBeenCalledWith(notification);
        // Expect event emitted on success
        expect(emitSpy).toHaveBeenCalledWith('notification.sent', expect.objectContaining({
            id: 'test-n-1',
            status: 'sent'
        }));
    });

    it('should retry on failure up to max retries', async () => {
        const manager = new ChannelManager({
            telegram: { token: 'mock', defaultChatId: 'mock' }
        });

        const telegramSendSpy = vi.spyOn((manager as any).telegramAdapter, 'send')
            .mockRejectedValue(new Error('Network error'));

        const notification: Notification = {
            id: 'test-n-2',
            channel: NotificationChannel.TELEGRAM,
            type: 'alert',
            title: 'Test',
            body: 'Test body',
            recipient: '',
            status: 'pending',
            createdAt: new Date()
        };

        const emitSpy = vi.spyOn(eventBus, 'emit');

        // We expect it to throw an error after all retries fail
        await expect(manager.sendNotification(notification)).rejects.toThrow(/Failed to send notification after 3 retries/);

        // Expect the adapter send was called 4 times (1 initial + 3 retries)
        expect(telegramSendSpy).toHaveBeenCalledTimes(4);

        // Expect failure event was emitted
        expect(emitSpy).toHaveBeenCalledWith('notification.failed', expect.objectContaining({
            id: 'test-n-2',
            status: 'failed'
        }));
    }, 15000); // Allow time for exponential backoff (1s + 2s + 4s = 7s)
});
