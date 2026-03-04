
import { useAuth } from '../lib/auth';

export default function Settings() {
    const { user, logout } = useAuth();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
            <header>
                <h1 style={{ margin: 0, marginBottom: '8px' }}>Global Settings</h1>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Configure platform preferences and credentials.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ margin: 0 }}>Account</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Logged in as:</span>
                        <div style={{ padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600 }}>{user?.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user?.email}</div>
                            <div style={{ marginTop: '8px', display: 'inline-block', padding: '2px 8px', backgroundColor: 'var(--accent-primary)', color: '#fff', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>
                                {user?.role}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        style={{
                            padding: '10px',
                            backgroundColor: 'transparent',
                            color: 'var(--status-critical)',
                            border: '1px solid var(--status-critical)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            marginTop: 'auto'
                        }}
                    >
                        Sign Out
                    </button>
                </div>

                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ margin: 0 }}>LLM Provider</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                        Configure default provider. Note: This requires updating API environment variables and restarting the server for changes to take effect securely.
                    </p>
                    <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                        Currently configured via .env file.
                    </div>
                </div>
            </div>
        </div>
    );
}
