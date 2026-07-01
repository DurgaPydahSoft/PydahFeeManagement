import { useEffect, useRef } from 'react';
import { clearAuthSession } from './auth';

/**
 * useSessionGuard
 *
 * Establishes a Server-Sent Events connection to the backend /api/sse/session
 * endpoint. Listens for a "force_logout" event which is emitted when another
 * device logs in with the same credentials, displacing this session.
 *
 * On displacement:
 *   1. Closes the SSE connection
 *   2. Clears all local auth state
 *   3. Sets a sessionStorage flag so the login page shows the security modal
 *   4. Redirects to /login
 *
 * Usage: Call this hook once at the App level.
 */
const useSessionGuard = () => {
    const esRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const isOnLoginPage = window.location.pathname === '/login';
        if (isOnLoginPage) return;

        // Build the SSE URL.
        // VITE_API_URL already includes /api (e.g. http://localhost:5001/api)
        const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
        const sseUrl = baseUrl + '/sse/session?token=' + encodeURIComponent(token);

        let es = null;
        let closed = false;

        // Small delay ensures React StrictMode double-invoke cleanup doesn't
        // kill the connection immediately in development.
        const timer = setTimeout(() => {
            if (closed) return;

            es = new EventSource(sseUrl);
            esRef.current = es;

            es.addEventListener('connected', () => {
                console.log('[SessionGuard] SSE connected — session guard active');
            });

            es.addEventListener('force_logout', () => {
                console.warn('[SessionGuard] force_logout received — ending this session');
                es.close();
                esRef.current = null;
                clearAuthSession();
                sessionStorage.setItem('session_displaced', '1');
                window.location.assign('/login');
            });

            es.onerror = () => {
                // EventSource auto-reconnects on error — no action needed here.
                // The guard will re-establish after the server comes back.
            };
        }, 100);

        return () => {
            closed = true;
            clearTimeout(timer);
            if (es) {
                es.close();
            }
            esRef.current = null;
        };
    }, [localStorage.getItem('token')]); // Re-run when token changes (new login on same tab)
};

export default useSessionGuard;

