import { createContext, useContext, useState } from 'react';
import { UserRole } from '@fangops/core/types';

interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

interface AuthContextType {
    token: string | null;
    user: AuthUser | null;
    login: (token: string, user: AuthUser) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(localStorage.getItem('fangops_token'));
    const [user, setUser] = useState<AuthUser | null>(() => {
        const storedUser = localStorage.getItem('fangops_user');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const login = (newToken: string, newUser: AuthUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('fangops_token', newToken);
        localStorage.setItem('fangops_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('fangops_token');
        localStorage.removeItem('fangops_user');
    };

    return (
        <AuthContext.Provider value={{ token, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
