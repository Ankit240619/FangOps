import type { Incident } from '@fangops/core';
import { IncidentStatus } from '@fangops/core';
import { SEVERITY_COLORS, SEVERITY_EMOJIS, escapeTelegramMarkdown } from './alert-template.js';

export function formatIncidentForSlack(incident: Incident): any[] {

    const isResolved = incident.status === IncidentStatus.RESOLVED;
    const statusText = isResolved ? '✅ INCIDENT RESOLVED' : `🔥 INCIDENT UPDATE: ${incident.status.toUpperCase()}`;

    const blocks: any[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${statusText}: ${incident.title}`,
                emoji: true
            }
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: incident.description || 'No description provided.'
            }
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Status:*\n${incident.status.toUpperCase()}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Severity:*\n${incident.severity.toUpperCase()}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Assignee:*\n${incident.assignee || 'Unassigned'}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Created At:*\n${typeof incident.createdAt === 'string' ? new Date(incident.createdAt).toISOString() : incident.createdAt.toISOString()}`
                }
            ]
        }
    ];

    if (incident.resolvedAt) {
        blocks[2].fields.push({
            type: 'mrkdwn',
            text: `*Resolved At:*\n${typeof incident.resolvedAt === 'string' ? new Date(incident.resolvedAt).toISOString() : incident.resolvedAt.toISOString()}`
        });
    }

    if (incident.timeline && incident.timeline.length > 0) {
        const latestUpdates = incident.timeline.slice(-3).reverse(); // Show last 3 updates
        let timelineText = '*Recent Updates:*\n';
        for (const entry of latestUpdates) {
            timelineText += `• _${typeof entry.timestamp === 'string' ? new Date(entry.timestamp).toISOString() : entry.timestamp.toISOString()}_ - *${entry.actor}*: ${entry.message}\n`;
        }

        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: timelineText
            }
        });
    }

    return blocks;
}

export function formatIncidentForTelegram(incident: Incident): string {
    const emoji = SEVERITY_EMOJIS[incident.severity] || '⚪';
    const isResolved = incident.status === IncidentStatus.RESOLVED;
    const statusText = isResolved ? '✅ *INCIDENT RESOLVED*' : `🔥 *INCIDENT UPDATE: ${escapeTelegramMarkdown(incident.status.toUpperCase())}*`;

    let text = `${statusText} - ${emoji} *${escapeTelegramMarkdown(incident.title)}*\n\n`;
    text += `${escapeTelegramMarkdown(incident.description || 'No description provided.')}\n\n`;
    text += `*Status:* ${escapeTelegramMarkdown(incident.status.toUpperCase())}\n`;
    text += `*Severity:* ${escapeTelegramMarkdown(incident.severity.toUpperCase())}\n`;
    text += `*Assignee:* ${escapeTelegramMarkdown(incident.assignee || 'Unassigned')}\n`;
    text += `*Created:* ${escapeTelegramMarkdown(typeof incident.createdAt === 'string' ? new Date(incident.createdAt).toISOString() : incident.createdAt.toISOString())}\n`;

    if (incident.resolvedAt) {
        text += `*Resolved:* ${escapeTelegramMarkdown(typeof incident.resolvedAt === 'string' ? new Date(incident.resolvedAt).toISOString() : incident.resolvedAt.toISOString())}\n`;
    }

    if (incident.timeline && incident.timeline.length > 0) {
        const latestUpdates = incident.timeline.slice(-3).reverse();
        text += `\n*Recent Updates:*\n`;
        for (const entry of latestUpdates) {
            text += `\\• _${escapeTelegramMarkdown(typeof entry.timestamp === 'string' ? new Date(entry.timestamp).toISOString() : entry.timestamp.toISOString())}_ \\- *${escapeTelegramMarkdown(entry.actor)}*: ${escapeTelegramMarkdown(entry.message)}\n`;
        }
    }

    return text;
}

export function formatIncidentForEmail(incident: Incident): string {
    const emoji = SEVERITY_EMOJIS[incident.severity] || '⚪';
    const color = SEVERITY_COLORS[incident.severity] || '#808080';
    const isResolved = incident.status === IncidentStatus.RESOLVED;
    const statusText = isResolved ? '✅ INCIDENT RESOLVED' : `🔥 INCIDENT UPDATE: ${incident.status.toUpperCase()}`;

    let timelineHtml = '';
    if (incident.timeline && incident.timeline.length > 0) {
        const latestUpdates = incident.timeline.slice(-5).reverse();
        timelineHtml = `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
                <strong>Recent Updates:</strong>
                <ul style="padding-left: 20px; font-size: 13px; color: #555;">
                    ${latestUpdates.map(entry => `<li><em>${typeof entry.timestamp === 'string' ? new Date(entry.timestamp).toISOString() : entry.timestamp.toISOString()}</em> - <strong>${entry.actor}</strong>: ${entry.message}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-top: 5px solid ${color}; border-radius: 8px; overflow: hidden;">
        <div style="padding: 16px; background-color: #f9f9f9; border-bottom: 1px solid #ddd;">
            <h2 style="margin: 0; color: #333; font-size: 18px;">${statusText}: ${incident.title} ${emoji}</h2>
        </div>
        <div style="padding: 16px;">
            <p style="margin-top: 0; color: #555;">${incident.description || 'No description provided.'}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777; width: 30%;">Status</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${incident.status.toUpperCase()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Severity</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: ${color};">${incident.severity.toUpperCase()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Assignee</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${incident.assignee || 'Unassigned'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Created At</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${typeof incident.createdAt === 'string' ? new Date(incident.createdAt).toISOString() : incident.createdAt.toISOString()}</td>
                </tr>
                ${incident.resolvedAt ? `
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Resolved At</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${typeof incident.resolvedAt === 'string' ? new Date(incident.resolvedAt).toISOString() : incident.resolvedAt.toISOString()}</td>
                </tr>
                ` : ''}
            </table>
            ${timelineHtml}
        </div>
    </div>
    `;
}
