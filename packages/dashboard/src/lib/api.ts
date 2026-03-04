export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('fangops_token');

    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        if (res.status === 401) {
            localStorage.removeItem('fangops_token');
            localStorage.removeItem('fangops_user');
            window.location.href = '/login';
        }
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }

    return res.json();
}
