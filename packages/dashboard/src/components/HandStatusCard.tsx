
import { HandStatus } from '@fangops/core/types';
import { Play, Square, Pause } from 'lucide-react';

interface Props {
    id: string;
    name: string;
    status: HandStatus;
    description: string;
    onStart?: () => void;
    onStop?: () => void;
    onPause?: () => void;
}

const statusConfig = {
    [HandStatus.RUNNING]: { color: 'var(--status-info)', label: 'Running', dot: 'heartbeat-dot' },
    [HandStatus.STOPPED]: { color: 'var(--text-muted)', label: 'Stopped', dot: '' },
    [HandStatus.PAUSED]: { color: 'var(--status-medium)', label: 'Paused', dot: '' },
    [HandStatus.ERROR]: { color: 'var(--status-critical)', label: 'Error', dot: '' },
    [HandStatus.INITIALIZING]: { color: 'var(--accent-primary)', label: 'Initializing', dot: '' },
};

export default function HandStatusCard({ name, status, description, onStart, onStop, onPause }: Props) {
    const config = statusConfig[status];

    return (
        <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{name}</h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{description}</p>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 12px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '16px',
                    border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`
                }}>
                    <div className={config.dot} style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        backgroundColor: config.color,
                        boxShadow: `0 0 8px ${config.color}`
                    }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: config.color }}>{config.label}</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                    onClick={onStart}
                    disabled={status === HandStatus.RUNNING}
                    style={{
                        flex: 1,
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backgroundColor: status === HandStatus.RUNNING ? 'transparent' : 'color-mix(in srgb, var(--status-info) 10%, transparent)',
                        color: status === HandStatus.RUNNING ? 'var(--text-muted)' : 'var(--status-info)',
                        border: status === HandStatus.RUNNING ? '1px solid var(--border-color)' : `1px solid color-mix(in srgb, var(--status-info) 20%, transparent)`,
                        borderRadius: '6px',
                        cursor: status === HandStatus.RUNNING ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '0.875rem'
                    }}
                >
                    <Play size={16} /> Start
                </button>
                <button
                    onClick={onPause}
                    disabled={status !== HandStatus.RUNNING}
                    style={{
                        flex: 1,
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backgroundColor: 'transparent',
                        color: status !== HandStatus.RUNNING ? 'var(--text-muted)' : 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: status !== HandStatus.RUNNING ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '0.875rem'
                    }}
                >
                    <Pause size={16} /> Pause
                </button>
                <button
                    onClick={onStop}
                    disabled={status === HandStatus.STOPPED}
                    style={{
                        flex: 1,
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backgroundColor: 'transparent',
                        color: status === HandStatus.STOPPED ? 'var(--text-muted)' : 'var(--status-critical)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: status === HandStatus.STOPPED ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '0.875rem'
                    }}
                >
                    <Square size={16} /> Stop
                </button>
            </div>
        </div>
    );
}
