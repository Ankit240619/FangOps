import { describe, it, expect, vi } from 'vitest';
import { EmailAdapter } from '../channels/email-adapter.js';
import { type Notification, NotificationChannel } from '@fangops/core';

// Mock nodemailer
vi.mock('nodemailer', () => {
    return {
        default: {
            createTransport: vi.fn().mockImplementation(() => {
                return {
                    sendMail: vi.fn().mockResolvedValue({ messageId: '123' })
                };
            })
        }
    };
});

describe('EmailAdapter', () => {
    it('should initialize and send an email via nodemailer', async () => {
        const config = {
            host: 'smtp.example.com',
            port: 587,
            user: 'user@example.com',
            pass: 'pass123',
            fromAddress: 'system@example.com',
            defaultToAddress: 'admin@example.com'
        };

        const adapter = new EmailAdapter(config);

        const notification: Notification = {
            id: '1',
            channel: NotificationChannel.EMAIL,
            type: 'alert',
            title: 'Critical Alert',
            body: 'Server down',
            richBody: '<h1>Server down</h1>',
            recipient: 'ops@example.com',
            status: 'pending',
            createdAt: new Date()
        };

        await adapter.send(notification);

        const mockTransport = (adapter as any).transporter;
        expect(mockTransport.sendMail).toHaveBeenCalledWith({
            from: 'system@example.com',
            to: 'ops@example.com',
            subject: 'Critical Alert',
            text: undefined,
            html: '<h1>Server down</h1>'
        });
    });

    it('should fall back to default text if no richBody exists', async () => {
        const adapter = new EmailAdapter({
            host: 'smtp.example.com',
            port: 587,
            user: 'u',
            pass: 'p',
            fromAddress: 'f@test.com',
            defaultToAddress: 'to@test.com'
        });

        const notification: Notification = {
            id: '2',
            channel: NotificationChannel.EMAIL,
            type: 'system',
            title: 'Hello',
            body: 'Hello World',
            recipient: '',
            status: 'pending',
            createdAt: new Date()
        };

        await adapter.send(notification);

        const mockTransport = (adapter as any).transporter;
        expect(mockTransport.sendMail).toHaveBeenCalledWith({
            from: 'f@test.com',
            to: 'to@test.com',
            subject: 'Hello',
            text: 'Hello World',
            html: undefined
        });
    });
});
