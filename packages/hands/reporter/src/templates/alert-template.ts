import type { Alert } from '@fangops/core';
import { AlertSeverity, AlertStatus } from '@fangops/core';

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
    [AlertSeverity.CRITICAL]: '#FF0000', // Red
    [AlertSeverity.HIGH]: '#FF8C00',     // Orange
    [AlertSeverity.MEDIUM]: '#FFFF00',   // Yellow
    [AlertSeverity.LOW]: '#0000FF',      // Blue
    [AlertSeverity.INFO]: '#808080',     // Gray
};

const SEVERITY_EMOJIS: Record<AlertSeverity, string> = {
    [AlertSeverity.CRITICAL]: '🔴',
    [AlertSeverity.HIGH]: '🟠',
    [AlertSeverity.MEDIUM]: '🟡',
    [AlertSeverity.LOW]: '🔵',
    [AlertSeverity.INFO]: '⚪',
};

export function formatAlertForSlack(alert: Alert): any[] {
    const statusText = alert.status === AlertStatus.RESOLVED ? '✅ RESOLVED' : `🚨 ${alert.status.toUpperCase()}`;

    const blocks: any[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${statusText}: ${alert.title}`,
                emoji: true
            }
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: alert.description || 'No description provided.'
            }
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Severity:*\n${alert.severity.toUpperCase()}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Source:*\n${alert.source.name} (${alert.source.type})`
                },
                {
                    type: 'mrkdwn',
                    text: `*Starts At:*\n${alert.startsAt.toISOString()}`
                }
            ]
        }
    ];

    if (alert.endsAt) {
        blocks[2].fields.push({
            type: 'mrkdwn',
            text: `*Ends At:*\n${alert.endsAt.toISOString()}`
        });
    }

    const labelsText = Object.entries(alert.labels || {})
        .map(([k, v]) => `\`${k}: ${v}\``)
        .join(' ');

    if (labelsText) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Labels:*\n${labelsText}`
            }
        });
    }

    // Attach color by wrapping in an attachment container where caller uses it
    // Usually Slack attachments have `color`. We return blocks here, but caller might need color.
    // The Slack SDK allows { attachments: [{ color, blocks }] }. We'll let SlackAdapter handle that by exporting color.
    return blocks;
}

export function formatAlertForTelegram(alert: Alert): string {
    const emoji = SEVERITY_EMOJIS[alert.severity] || '⚪';
    const statusText = alert.status === AlertStatus.RESOLVED ? '✅ *RESOLVED*' : `🚨 *${alert.status.toUpperCase()}*`;

    let text = `${statusText} - ${emoji} *${escapeTelegramMarkdown(alert.title)}*\n\n`;
    text += `${escapeTelegramMarkdown(alert.description || 'No description provided.')}\n\n`;
    text += `*Severity:* ${escapeTelegramMarkdown(alert.severity.toUpperCase())}\n`;
    text += `*Source:* ${escapeTelegramMarkdown(alert.source.name)} \\(${escapeTelegramMarkdown(alert.source.type)}\\)\n`;
    text += `*Started:* ${escapeTelegramMarkdown(alert.startsAt.toISOString())}\n`;

    if (alert.endsAt) {
        text += `*Resolved:* ${escapeTelegramMarkdown(alert.endsAt.toISOString())}\n`;
    }

    const labelsText = Object.entries(alert.labels || {})
        .map(([k, v]) => `\`${escapeTelegramMarkdown(k)}: ${escapeTelegramMarkdown(String(v))}\``)
        .join(' ');

    if (labelsText) {
        text += `\n*Labels:*\n${labelsText}`;
    }

    return text;
}

export function formatAlertForEmail(alert: Alert): string {
    const emoji = SEVERITY_EMOJIS[alert.severity] || '⚪';
    const color = SEVERITY_COLORS[alert.severity] || '#808080';
    const statusText = alert.status === AlertStatus.RESOLVED ? '✅ RESOLVED' : `🚨 ${alert.status.toUpperCase()}`;

    const labelsHtml = Object.entries(alert.labels || {})
        .map(([k, v]) => `<span style="background-color: #eee; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 12px; margin-right: 4px;">${k}: ${v}</span>`)
        .join('');

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-top: 5px solid ${color}; border-radius: 8px; overflow: hidden;">
        <div style="padding: 16px; background-color: #f9f9f9; border-bottom: 1px solid #ddd;">
            <h2 style="margin: 0; color: #333; font-size: 18px;">${statusText}: ${alert.title} ${emoji}</h2>
        </div>
        <div style="padding: 16px;">
            <p style="margin-top: 0; color: #555;">${alert.description || 'No description provided.'}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777; width: 30%;">Severity</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${alert.severity.toUpperCase()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Source</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${alert.source.name} (${alert.source.type})</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Started At</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${alert.startsAt.toISOString()}</td>
                </tr>
                ${alert.endsAt ? `
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Resolved At</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${alert.endsAt.toISOString()}</td>
                </tr>
                ` : ''}
            </table>
            ${labelsHtml ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;"><strong>Labels:</strong><br><div style="margin-top: 8px;">${labelsHtml}</div></div>` : ''}
        </div>
    </div>
    `;
}

// Helper to escape reserved MarkdownV2 characters for Telegram
export function escapeTelegramMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export { SEVERITY_COLORS, SEVERITY_EMOJIS };
