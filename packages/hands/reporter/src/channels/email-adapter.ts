import type { Notification } from '@fangops/core';
import { NotificationChannel } from '@fangops/core';
import nodemailer from 'nodemailer';

export interface EmailAdapterConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromAddress: string;
    defaultToAddress: string;
}

export class EmailAdapter {
    private transporter: nodemailer.Transporter;
    private config: EmailAdapterConfig;

    constructor(config: EmailAdapterConfig) {
        if (!config.host || !config.user || !config.pass) {
            throw new Error('Email configuration is incomplete');
        }
        this.config = config;

        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
                user: config.user,
                pass: config.pass
            }
        });
    }

    async send(notification: Notification): Promise<void> {
        if (notification.channel !== NotificationChannel.EMAIL) {
            throw new Error(`EmailAdapter cannot handle channel: ${notification.channel}`);
        }

        const to = notification.recipient || this.config.defaultToAddress;
        const html = (notification.richBody as string) || undefined;
        const text = html ? undefined : notification.body;

        try {
            await this.transporter.sendMail({
                from: this.config.fromAddress,
                to,
                subject: notification.title,
                text,
                html
            });
        } catch (error: any) {
            throw new Error(`Failed to send Email: ${error.message}`);
        }
    }
}
