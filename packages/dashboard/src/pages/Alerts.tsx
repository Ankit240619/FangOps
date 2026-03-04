import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';
import AlertCard from '../components/AlertCard';
import { AlertSeverity } from '@fangops/core/types';
import { Filter } from 'lucide-react';

export default function Alerts() {
    const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');

    const { data: alertsRes, isLoading } = useQuery({
        queryKey: ['alerts'],
        queryFn: () => fetchApi('/alerts?pageSize=100'),
    });

    const alerts = alertsRes?.data || [];
    const filteredAlerts = severityFilter === 'ALL'
        ? alerts
        : alerts.filter((a: any) => a.severity === severityFilter);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, marginBottom: '8px' }}>Alerts Feed</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Real-time stream of system alerts.</p>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Filter size={16} color="var(--text-muted)" />
                    <select
                        value={severityFilter}
                        onChange={e => setSeverityFilter(e.target.value as any)}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                        }}
                    >
                        <option value="ALL">All Severities</option>
                        {Object.values(AlertSeverity).map(s => (
                            <option key={s} value={s}>{s.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading alerts...</div>
                ) : filteredAlerts.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                        No alerts match your filter.
                    </div>
                ) : (
                    filteredAlerts.map((alert: any) => (
                        <AlertCard
                            key={alert.id}
                            title={alert.title}
                            description={alert.description}
                            severity={alert.severity}
                            timeAgo={new Date(alert.startsAt).toLocaleString()}
                            source={alert.source?.type || 'unknown'}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
