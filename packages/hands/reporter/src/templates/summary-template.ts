import type { DailyHealthSummary } from '@fangops/core';
import { SEVERITY_EMOJIS, escapeTelegramMarkdown } from './alert-template.js';

export function formatSummaryForSlack(summary: DailyHealthSummary): any[] {
    const blocks: any[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `📊 Daily Health Summary for ${typeof summary.date === 'string' ? new Date(summary.date).toLocaleDateString() : summary.date.toLocaleDateString()}`,
                emoji: true
            }
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `_${summary.narrative}_`
            }
        },
        {
            type: 'divider'
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Total Alerts:*\n${summary.totalAlerts}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Critical Alerts:*\n${summary.criticalAlerts} 🔴`
                },
                {
                    type: 'mrkdwn',
                    text: `*Active Incidents:*\n${summary.activeIncidents}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Resolved Incidents:*\n${summary.resolvedIncidents}`
                },
                {
                    type: 'mrkdwn',
                    text: `*MTTR:*\n${summary.mttrMinutes !== undefined ? `${summary.mttrMinutes.toFixed(1)} mins` : 'N/A'}`
                },
                {
                    type: 'mrkdwn',
                    text: `*LLM Cost (24h):*\n$${summary.llmCostUsd.toFixed(2)} 💰`
                }
            ]
        }
    ];

    if (summary.topIssues && summary.topIssues.length > 0) {
        let issuesText = '';
        summary.topIssues.forEach((issue, index) => {
            const emoji = SEVERITY_EMOJIS[issue.severity] || '⚪';
            issuesText += `${index + 1}. ${emoji} *${issue.title}* (${issue.count} occurrences)\n`;
        });

        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Top Issues:*\n${issuesText}`
            }
        });
    }

    if (summary.handStatuses && summary.handStatuses.length > 0) {
        let handsText = '';
        summary.handStatuses.forEach(hand => {
            const statusEmoji = hand.status === 'running' ? '🟢' : '🔴';
            handsText += `${statusEmoji} *${hand.name}*: ${hand.status}\n`;
        });

        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Agent Statuses:*\n${handsText}`
            }
        });
    }

    return blocks;
}

export function formatSummaryForTelegram(summary: DailyHealthSummary): string {
    const dateStr = typeof summary.date === 'string' ? new Date(summary.date).toLocaleDateString() : summary.date.toLocaleDateString();
    let text = `📊 *Daily Health Summary \\- ${escapeTelegramMarkdown(dateStr)}*\n\n`;
    text += `_${escapeTelegramMarkdown(summary.narrative)}_\n\n`;

    text += `*Stats:*\n`;
    text += `\\• Total Alerts: ${summary.totalAlerts}\n`;
    text += `\\• Critical Alerts: ${summary.criticalAlerts} 🔴\n`;
    text += `\\• Active Incidents: ${summary.activeIncidents}\n`;
    text += `\\• Resolved Incidents: ${summary.resolvedIncidents}\n`;
    text += `\\• MTTR: ${summary.mttrMinutes !== undefined ? escapeTelegramMarkdown(`${summary.mttrMinutes.toFixed(1)} mins`) : 'N/A'}\n`;
    text += `\\• AI Cost: $${escapeTelegramMarkdown(summary.llmCostUsd.toFixed(2))}\n\n`;

    if (summary.topIssues && summary.topIssues.length > 0) {
        text += `*Top Issues:*\n`;
        summary.topIssues.forEach((issue, index) => {
            const emoji = SEVERITY_EMOJIS[issue.severity] || '⚪';
            text += `${index + 1}\\. ${emoji} ${escapeTelegramMarkdown(issue.title)} \\(${issue.count} occurrences\\)\n`;
        });
        text += '\n';
    }

    if (summary.handStatuses && summary.handStatuses.length > 0) {
        text += `*Agent Statuses:*\n`;
        summary.handStatuses.forEach(hand => {
            const statusEmoji = hand.status === 'running' ? '🟢' : '🔴';
            text += `${statusEmoji} *${escapeTelegramMarkdown(hand.name)}*: ${escapeTelegramMarkdown(hand.status)}\n`;
        });
    }

    return text;
}

export function formatSummaryForEmail(summary: DailyHealthSummary): string {
    const dateStr = typeof summary.date === 'string' ? new Date(summary.date).toLocaleDateString() : summary.date.toLocaleDateString();

    let issuesHtml = '';
    if (summary.topIssues && summary.topIssues.length > 0) {
        issuesHtml = `
            <h3 style="color: #333; margin-top: 24px;">Top Issues</h3>
            <ul style="padding-left: 20px; font-size: 14px; color: #555;">
                ${summary.topIssues.map(issue => `<li>${SEVERITY_EMOJIS[issue.severity] || '⚪'} <strong>${issue.title}</strong> (${issue.count} occurrences)</li>`).join('')}
            </ul>
        `;
    }

    let handsHtml = '';
    if (summary.handStatuses && summary.handStatuses.length > 0) {
        handsHtml = `
            <h3 style="color: #333; margin-top: 24px;">Agent Statuses</h3>
            <ul style="padding-left: 20px; font-size: 14px; color: #555;">
                ${summary.handStatuses.map(hand => `<li>${hand.status === 'running' ? '🟢' : '🔴'} <strong>${hand.name}</strong>: ${hand.status}</li>`).join('')}
            </ul>
        `;
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-top: 5px solid #4CAF50; border-radius: 8px; overflow: hidden;">
        <div style="padding: 16px; background-color: #f9f9f9; border-bottom: 1px solid #ddd; text-align: center;">
            <h2 style="margin: 0; color: #333; font-size: 20px;">📊 Daily Health Summary</h2>
            <p style="margin: 4px 0 0; color: #777; font-size: 14px;">${dateStr}</p>
        </div>
        <div style="padding: 20px;">
            <div style="background-color: #f0f7ff; padding: 12px; border-left: 4px solid #2196F3; font-style: italic; color: #444; border-radius: 4px; font-size: 15px;">
                ${summary.narrative}
            </div>
            
            <h3 style="color: #333; margin-top: 24px;">Key Metrics</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; background-color: #fafafa; width: 50%;">Total Alerts</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${summary.totalAlerts}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; background-color: #fafafa;">Critical Alerts</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #f44336;">${summary.criticalAlerts} 🔴</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; background-color: #fafafa;">Active Incidents</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${summary.activeIncidents}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; background-color: #fafafa;">Resolved Incidents</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${summary.resolvedIncidents}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; background-color: #fafafa;">MTTR</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${summary.mttrMinutes !== undefined ? `${summary.mttrMinutes.toFixed(1)} mins` : 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; background-color: #fafafa;">AI Cost (24h)</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">$${summary.llmCostUsd.toFixed(2)}</td>
                </tr>
            </table>

            ${issuesHtml}
            ${handsHtml}
        </div>
        <div style="padding: 12px; background-color: #f9f9f9; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #ddd;">
            FangOps System Report • Generated automatically
        </div>
    </div>
    `;
}
