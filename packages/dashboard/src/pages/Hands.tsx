
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';
import HandStatusCard from '../components/HandStatusCard';

export default function Hands() {
    const queryClient = useQueryClient();

    const { data: handsRes, isLoading } = useQuery({
        queryKey: ['hands'],
        queryFn: () => fetchApi('/hands'),
    });

    const toggleAction = useMutation({
        mutationFn: ({ id, action }: { id: string; action: 'start' | 'stop' | 'pause' }) =>
            fetchApi(`/hands/${id}/${action}`, { method: 'POST' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hands'] }),
    });

    const hands = handsRes?.data || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
            <header>
                <h1 style={{ margin: 0, marginBottom: '8px' }}>Hands Management</h1>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage and configure agentic endpoints for your cluster.</p>
            </header>

            {isLoading ? (
                <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading hands...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                    {hands.map((hand: any) => (
                        <HandStatusCard
                            key={hand.id}
                            id={hand.id}
                            name={hand.name}
                            description={hand.description}
                            status={hand.status}
                            onStart={() => toggleAction.mutate({ id: hand.id, action: 'start' })}
                            onStop={() => toggleAction.mutate({ id: hand.id, action: 'stop' })}
                            onPause={() => toggleAction.mutate({ id: hand.id, action: 'pause' })}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
