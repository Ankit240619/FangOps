
import { AlertSeverity } from '@fangops/core/types';
import { AlertTriangle, Info, ShieldAlert, AlertCircle, Activity } from 'lucide-react';

interface Props {
    title: string;
    description: string;
    severity: AlertSeverity;
    timeAgo: string;
    source: string;
}

const severityConfig = {
    [AlertSeverity.CRITICAL]: { color: 'var(--status-critical)', icon: ShieldAlert, bg: 'rgba(239, 68, 68, 0.1)' },
    [AlertSeverity.HIGH]: { color: 'var(--status-high)', icon: AlertTriangle, bg: 'rgba(249, 115, 22, 0.1)' },
    [AlertSeverity.MEDIUM]: { color: 'var(--status-medium)', icon: AlertCircle, bg: 'rgba(234, 179, 8, 0.1)' },
    [AlertSeverity.LOW]: { color: 'var(--status-low)', icon: Activity, bg: 'rgba(59, 130, 246, 0.1)' },
    [AlertSeverity.INFO]: { color: 'var(--status-info)', icon: Info, bg: 'rgba(16, 185, 129, 0.1)' },
};

export default function AlertCard({ title, description, severity, timeAgo, source }: Props) {
    const config = severityConfig[severity] || severityConfig[AlertSeverity.INFO];
    const Icon = config.icon;

    return (
        <div style={{
            padding: '16px',
            backgroundColor: 'var(--bg-secondary)',
            border: `1px solid var(--border-color)`,
            borderLeft: `4px solid ${config.color}`,
            borderRadius: '8px',
            display: 'flex',
            gap: '16px',
            transition: 'transform 0.2s',
            cursor: 'pointer',
        }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: config.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: config.color,
                flexShrink: 0
            }}>
                <Icon size={20} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {title}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                        {timeAgo}
                    </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {description}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        {source}
                    </span>
                </div>
            </div>
        </div>
    );
}
