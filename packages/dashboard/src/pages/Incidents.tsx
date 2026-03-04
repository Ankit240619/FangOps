
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

export default function Incidents() {
    const { data: incidentsRes, isLoading } = useQuery({
        queryKey: ['incidents'],
        queryFn: () => fetchApi('/incidents'),
    });

    const incidents = incidentsRes?.data || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
            <header>
                <h1 style={{ margin: 0, marginBottom: '8px' }}>Incidents</h1>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Active and un-resolved incidents.</p>
            </header>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                            <th style={{ padding: '16px', fontWeight: 500, color: 'var(--text-muted)' }}>ID</th>
                            <th style={{ padding: '16px', fontWeight: 500, color: 'var(--text-muted)' }}>Title</th>
                            <th style={{ padding: '16px', fontWeight: 500, color: 'var(--text-muted)' }}>Status</th>
                            <th style={{ padding: '16px', fontWeight: 500, color: 'var(--text-muted)' }}>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
                        ) : incidents.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No incidents found.</td></tr>
                        ) : (
                            incidents.map((incident: any) => (
                                <tr key={incident.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>#{incident.id.slice(0, 8)}</td>
                                    <td style={{ padding: '16px', fontWeight: 500 }}>{incident.title}</td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{ padding: '4px 12px', borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                                            {incident.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        {new Date(incident.createdAt).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
