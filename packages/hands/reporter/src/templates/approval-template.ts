import type { RemediationAction } from '@fangops/core';
import { RemediationTier } from '@fangops/core';
import { escapeTelegramMarkdown } from './alert-template.js';

export function formatApprovalForSlack(action: RemediationAction): any[] {
    const isApproved = action.status === 'approved';
    const isCompleted = action.status === 'completed';
    const isFailed = action.status === 'failed';

    let statusEmoji = '⏳';

    if (isApproved) { statusEmoji = '👍'; }
    if (isCompleted) { statusEmoji = '✅'; }
    if (isFailed) { statusEmoji = '❌'; }

    const blocks: any[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${statusEmoji} Remediation Action: ${action.status.toUpperCase()}`,
                emoji: true
            }
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Incident ID:*\n${action.incidentId}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Tier:*\n${action.tier.toUpperCase()}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Action:*\n\`${action.action}\``
                },
                {
                    type: 'mrkdwn',
                    text: `*Proposed At:*\n${typeof action.proposedAt === 'string' ? new Date(action.proposedAt).toISOString() : action.proposedAt.toISOString()}`
                }
            ]
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Description:*\n${action.description}`
            }
        }
    ];

    if (action.approvedBy) {
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `👤 Approved by: *${action.approvedBy}*`
                }
            ]
        });
    }

    if (action.result) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Result:*\n\`\`\`${action.result}\`\`\``
            }
        });
    }

    if (action.status === 'proposed' && action.tier === RemediationTier.APPROVAL) {
        blocks.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'Approve',
                        emoji: true
                    },
                    style: 'primary',
                    value: `approve_${action.id}`
                },
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'Reject',
                        emoji: true
                    },
                    style: 'danger',
                    value: `reject_${action.id}`
                }
            ]
        });
    }

    return blocks;
}

export function formatApprovalForTelegram(action: RemediationAction): string {
    let text = `⚙️ *Remediation Action: ${escapeTelegramMarkdown(action.status.toUpperCase())}*\n\n`;
    text += `*Incident:* ${escapeTelegramMarkdown(action.incidentId)}\n`;
    text += `*Tier:* ${escapeTelegramMarkdown(action.tier.toUpperCase())}\n`;
    text += `*Action:* \`${escapeTelegramMarkdown(action.action)}\`\n`;
    text += `*Description:* ${escapeTelegramMarkdown(action.description)}\n`;
    text += `*Proposed:* ${escapeTelegramMarkdown(typeof action.proposedAt === 'string' ? new Date(action.proposedAt).toISOString() : action.proposedAt.toISOString())}\n`;

    if (action.approvedBy) {
        text += `\n👤 *Approved By:* ${escapeTelegramMarkdown(action.approvedBy)}\n`;
    }

    if (action.result) {
        text += `\n*Result:*\n\`\`\`\n${escapeTelegramMarkdown(action.result)}\n\`\`\`\n`;
    }

    return text;
}

export function formatApprovalForEmail(action: RemediationAction): string {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-top: 5px solid #FFA500; border-radius: 8px; overflow: hidden;">
        <div style="padding: 16px; background-color: #f9f9f9; border-bottom: 1px solid #ddd;">
            <h2 style="margin: 0; color: #333; font-size: 18px;">⚙️ Remediation: ${action.status.toUpperCase()}</h2>
        </div>
        <div style="padding: 16px;">
            <p style="margin-top: 0; color: #555;"><strong>Description:</strong> ${action.description}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777; width: 30%;">Incident ID</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${action.incidentId}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Action</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-family: monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 4px;">${action.action}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Tier</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${action.tier.toUpperCase()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Proposed At</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${typeof action.proposedAt === 'string' ? new Date(action.proposedAt).toISOString() : action.proposedAt.toISOString()}</td>
                </tr>
                ${action.approvedBy ? `
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Approved By</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${action.approvedBy}</td>
                </tr>
                ` : ''}
            </table>
            ${action.result ? `<div style="margin-top: 16px; padding: 12px; background-color: #f0f0f0; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap;"><strong>Result:</strong><br>${action.result}</div>` : ''}
        </div>
    </div>
    `;
}
