import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, API_BASE } from '../lib/api';
import MetricCard from '../components/MetricCard';
import AlertCard from '../components/AlertCard';
import HandStatusCard from '../components/HandStatusCard';
import { AlertCircle, Activity, Box, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Overview() {
    const [realtimeStats, setRealtimeStats] = useState<any>(null);

    const { data: alertsRes, isLoading: loadingAlerts } = useQuery({
        queryKey: ['alerts'],
        queryFn: () => fetchApi('/alerts?pageSize=5'),
    });

    const { data: handsRes, isLoading: loadingHands } = useQuery({
        queryKey: ['hands'],
        queryFn: () => fetchApi('/hands'),
    });

    const { data: llmRes } = useQuery({
        queryKey: ['llmCosts'],
        queryFn: () => fetchApi('/llm/costs'),
    });

    const startHand = async (id: string) => { await fetchApi(`/hands/${id}/start`, { method: 'POST' }); };
    const stopHand = async (id: string) => { await fetchApi(`/hands/${id}/stop`, { method: 'POST' }); };
    const pauseHand = async (id: string) => { await fetchApi(`/hands/${id}/pause`, { method: 'POST' }); };

    useEffect(() => {
        const token = localStorage.getItem('fangops_token');
        const evtSource = new EventSource(`${API_BASE}/sse/events?token=${token}`);

        evtSource.addEventListener('alert.received', (e: any) => {
            const data = JSON.parse(e.data);
            console.log('Real-time alert:', data);
            // In a real app we'd update query cache directly here
        });

        // Add dummy trend data for chart
        setRealtimeStats([
            { time: '00:00', alerts: 12 }, { time: '04:00', alerts: 5 }, { time: '08:00', alerts: 20 },
            { time: '12:00', alerts: 15 }, { time: '16:00', alerts: 30 }, { time: '20:00', alerts: 10 },
            { time: '24:00', alerts: 8 }
        ]);

        return () => evtSource.close();
    }, []);

    const alerts = alertsRes?.data || [];
    const hands = handsRes?.data || [];
    const totalCost = llmRes?.data?.totalCostUsd || 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
            <header>
                <h1 style={{ marginBottom: '8px' }}>Dashboard Overview</h1>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>System health and active hands status.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                <MetricCard title="Total Active Alerts" value={alertsRes?.meta?.total || 0} icon={AlertCircle} color="var(--status-critical)" />
                <MetricCard title="Active Incidents" value="2" icon={Activity} color="var(--status-high)" />
                <MetricCard title="Running Hands" value={hands.filter((h: any) => h.status === 'running').length} icon={Box} color="var(--status-info)" />
                <MetricCard title="LLM Cost (MTD)" value={`$${totalCost.toFixed(3)}`} icon={DollarSign} color="var(--status-medium)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Alert Volume Chart */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '1.25rem' }}>Alert Volume (Last 24h)</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                        {realtimeStats && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={realtimeStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" stroke="var(--border-color)" tick={{ fill: 'var(--text-muted)' }} />
                                    <YAxis stroke="var(--border-color)" tick={{ fill: 'var(--text-muted)' }} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                                        itemStyle={{ color: 'var(--text-primary)' }}
                                    />
                                    <Area type="monotone" dataKey="alerts" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorAlerts)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Hand Status List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '1.25rem' }}>Hands Status</h3>
                    {loadingHands ? <p>Loading hands...</p> : hands.map((hand: any) => (
                        <HandStatusCard
                            key={hand.id}
                            id={hand.id}
                            name={hand.name}
                            description={hand.description}
                            status={hand.status}
                            onStart={() => startHand(hand.id)}
                            onStop={() => stopHand(hand.id)}
                            onPause={() => pauseHand(hand.id)}
                        />
                    ))}
                </div>
            </div>

            {/* Recent Alerts List */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Recent Alerts</h3>
                    <a href="/alerts" style={{ fontSize: '0.875rem', fontWeight: 500 }}>View all →</a>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loadingAlerts ? <p>Loading alerts...</p> : alerts.map((alert: any) => (
                        <AlertCard
                            key={alert.id}
                            title={alert.title}
                            description={alert.description}
                            severity={alert.severity}
                            timeAgo={new Date(alert.startsAt).toLocaleTimeString()}
                            source={alert.source?.type || 'unknown'}
                        />
                    ))}
                    {alerts.length === 0 && !loadingAlerts && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                            No active alerts. System is healthy.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
