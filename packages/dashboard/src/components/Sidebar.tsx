
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertCircle, Activity, Box, Settings as SettingsIcon } from 'lucide-react';

import { useAuth } from '../lib/auth';

export default function Sidebar() {
    const { user } = useAuth();

    const navItems = [
        { path: '/', label: 'Overview', icon: LayoutDashboard },
        { path: '/alerts', label: 'Alerts', icon: AlertCircle },
        { path: '/incidents', label: 'Incidents', icon: Activity },
        { path: '/hands', label: 'Hands', icon: Box },
        { path: '/settings', label: 'Settings', icon: SettingsIcon },
    ];

    return (
        <aside style={{
            width: '260px',
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 0'
        }}>
            <div style={{ padding: '0 24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff' }}>
                    F
                </div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>FangOps</h1>
            </div>

            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
                {navItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                            backgroundColor: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                            fontWeight: isActive ? 600 : 500,
                            transition: 'all 0.2s ease',
                        })}
                    >
                        <item.icon size={20} />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || 'Operator'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role || 'User'}</div>
            </div>
        </aside>
    );
}
