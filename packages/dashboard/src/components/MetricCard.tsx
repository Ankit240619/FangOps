import type { LucideIcon } from 'lucide-react';

interface Props {
    title: string;
    value: string | number;
    trend?: {
        value: string;
        isPositive: boolean;
    };
    icon: LucideIcon;
    color?: string;
}

export default function MetricCard({ title, value, trend, icon: Icon, color = 'var(--accent-primary)' }: Props) {
    return (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</span>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon size={20} />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {value}
                </h3>
                {trend && (
                    <span style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: trend.isPositive ? 'var(--status-info)' : 'var(--status-critical)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        {trend.isPositive ? '↑' : '↓'} {trend.value}
                    </span>
                )}
            </div>
        </div>
    );
}
