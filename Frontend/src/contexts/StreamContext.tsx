import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface StreamEvent {
    type: string;
    data: any;
}

interface StreamContextType {
    connectionState: ConnectionState;
    addEventListener: (eventType: string, handler: (e: MessageEvent) => void) => void;
    removeEventListener: (eventType: string, handler: (e: MessageEvent) => void) => void;
}

const StreamContext = createContext<StreamContextType | null>(null);

// ============================================================================
// HOOK
// ============================================================================

export function useStream(): StreamContextType {
    const context = useContext(StreamContext);
    if (!context) {
        throw new Error('useStream must be used within StreamProvider');
    }
    return context;
}

interface StreamProviderProps {
    children: ReactNode;
}

export function StreamProvider({ children }: StreamProviderProps) {
    const { isAuthenticated, handleTokenRefreshFromStream, handleSessionRevokedFromStream } = useAuth();
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const eventHandlersRef = useRef<Map<string, Set<(e: MessageEvent) => void>>>(new Map());

    const connect = useCallback(() => {
        if (!isAuthenticated) return;

        setConnectionState('connecting');
        const sse = new EventSource(`${API_BASE}/api/v1/auth/stream`, { withCredentials: true });

        // Auth events
        sse.addEventListener('auth.token.refresh', (e) => {
            try {
                const { token } = JSON.parse(e.data);
                handleTokenRefreshFromStream(token);
                console.log('Token refreshed via SSE');
            } catch (error) {
                console.error('Failed to parse token refresh event', { error });
            }
        });

        sse.addEventListener('auth.session.revoked', (e) => {
            try {
                const { reason, banReason } = JSON.parse(e.data);
                console.log('Session revoked via SSE', { reason, banReason });
                handleSessionRevokedFromStream();
                sse.close();
            } catch (error) {
                console.error('Failed to parse session revoked event', { error });
            }
        });

        // System events
        sse.addEventListener('system.connected', (e) => {
            console.log('SSE connected', { data: e.data });
        });

        sse.addEventListener('system.heartbeat', () => {
            // Connection alive
        });

        sse.addEventListener('system.timeout', () => {
            console.warn('SSE connection timeout');
            sse.close();
        });

        // QR auth events
        sse.addEventListener('qr.status.update', (e) => {
            const handlers = eventHandlersRef.current.get('qr.status.update');
            if (handlers) {
                handlers.forEach(handler => handler(e));
            }
        });

        // AI chat events
        sse.addEventListener('ai.chat.chunk', (e) => {
            const handlers = eventHandlersRef.current.get('ai.chat.chunk');
            if (handlers) {
                handlers.forEach(handler => handler(e));
            }
        });

        sse.addEventListener('ai.chat.complete', (e) => {
            const handlers = eventHandlersRef.current.get('ai.chat.complete');
            if (handlers) {
                handlers.forEach(handler => handler(e));
            }
        });

        // Inbox events
        sse.addEventListener('inbox.notification.new', (e) => {
            const handlers = eventHandlersRef.current.get('inbox.notification.new');
            if (handlers) {
                handlers.forEach(handler => handler(e));
            }
        });

        sse.addEventListener('inbox.notification.read', (e) => {
            const handlers = eventHandlersRef.current.get('inbox.notification.read');
            if (handlers) {
                handlers.forEach(handler => handler(e));
            }
        });

        sse.onopen = () => {
            setConnectionState('connected');
            setReconnectAttempts(0);
            console.log('SSE connection established');
        };

        sse.onerror = () => {
            setConnectionState('error');
            sse.close();

            // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.warn('SSE connection error, reconnecting', { delay, attempts: reconnectAttempts });

            reconnectTimeoutRef.current = setTimeout(() => {
                setReconnectAttempts(prev => prev + 1);
                connect();
            }, delay);
        };

        eventSourceRef.current = sse;
    }, [isAuthenticated, reconnectAttempts, handleTokenRefreshFromStream, handleSessionRevokedFromStream]);

    useEffect(() => {
        if (isAuthenticated) {
            connect();
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [isAuthenticated, connect]);

    const addEventListener = useCallback((eventType: string, handler: (e: MessageEvent) => void) => {
        if (!eventHandlersRef.current.has(eventType)) {
            eventHandlersRef.current.set(eventType, new Set());
        }
        eventHandlersRef.current.get(eventType)!.add(handler);
    }, []);

    const removeEventListener = useCallback((eventType: string, handler: (e: MessageEvent) => void) => {
        const handlers = eventHandlersRef.current.get(eventType);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                eventHandlersRef.current.delete(eventType);
            }
        }
    }, []);

    return (
        <StreamContext.Provider value={{ connectionState, addEventListener, removeEventListener }}>
            {children}
        </StreamContext.Provider>
    );
}
