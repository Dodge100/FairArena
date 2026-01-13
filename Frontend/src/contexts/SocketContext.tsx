import React, { createContext, type ReactNode, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthState } from '../lib/auth';

interface SocketContextType {
    socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

interface SocketProviderProps {
    children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const { user, isSignedIn, isLoaded } = useAuthState();
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (isLoaded && isSignedIn && user) {
            // Create socket connection
            const socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || undefined, {
                transports: ['websocket', 'polling'],
            });

            socket.on('connect', () => {
                console.log('Connected to socket server');
                // Join user room
                socket.emit('join', user.id);
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from socket server');
            });

            socketRef.current = socket;

            return () => {
                socket.disconnect();
                socketRef.current = null;
            };
        } else if (socketRef.current) {
            // Disconnect if user logs out
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }, [isLoaded, isSignedIn, user]);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current }}>
            {children}
        </SocketContext.Provider>
    );
};
