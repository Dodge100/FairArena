import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

interface ChatSession {
    id: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
}

interface ChatContextType {
    currentSession: ChatSession | null;
    sessions: ChatSession[];
    isLoading: boolean;
    error: string | null;
    createNewSession: () => void;
    switchSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    sendMessage: (message: string) => Promise<void>;
    stopMessage: () => void;
    clearCurrentSession: () => void;
    regenerateLastMessage: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = 'fairarena_ai_sessions';
const CURRENT_SESSION_KEY = 'fairarena_ai_current_session';
const MAX_SESSIONS = 50; // Limit stored sessions

// Load sessions from localStorage
const loadSessions = (): ChatSession[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const sessions = JSON.parse(stored);
        // Convert date strings back to Date objects
        return sessions.map((session: ChatSession & { createdAt: string; updatedAt: string; messages: Array<Message & { timestamp: string }> }) => ({
            ...session,
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(session.updatedAt),
            messages: session.messages.map((msg) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
            })),
        }));
    } catch (error) {
        console.error('Error loading sessions from localStorage:', error);
        return [];
    }
};

// Save sessions to localStorage
const saveSessions = (sessions: ChatSession[]) => {
    try {
        // Keep only the most recent MAX_SESSIONS
        const sessionsToSave = sessions
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, MAX_SESSIONS);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsToSave));
    } catch (error) {
        console.error('Error saving sessions to localStorage:', error);
    }
};

// Load current session ID
const loadCurrentSessionId = (): string | null => {
    return localStorage.getItem(CURRENT_SESSION_KEY);
};

// Save current session ID
const saveCurrentSessionId = (sessionId: string) => {
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
};

export function ChatProvider({ children }: { children: ReactNode }) {
    const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(loadCurrentSessionId);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [abortController, setAbortController] = useState<AbortController | null>(null);

    // Debug information collection
    const [consoleLogs, setConsoleLogs] = useState<Array<{ level: string; message: string; timestamp: string }>>([]);
    const [errors, setErrors] = useState<Array<{ message: string; stack?: string; timestamp: string }>>([]);

    const currentSession = sessions.find(s => s.id === currentSessionId) || null;

    // Capture console logs and errors
    useEffect(() => {
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;

        const captureLog = (level: string, ...args: unknown[]) => {
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');

            setConsoleLogs(prev => [...prev.slice(-9), { // Keep last 10
                level,
                message: message.substring(0, 500), // Limit message length
                timestamp: new Date().toISOString(),
            }]);
        };

        const captureError = (event: ErrorEvent) => {
            setErrors(prev => [...prev.slice(-4), { // Keep last 5
                message: event.message.substring(0, 300),
                stack: event.error?.stack?.substring(0, 500),
                timestamp: new Date().toISOString(),
            }]);
        };

        const captureRejection = (event: PromiseRejectionEvent) => {
            setErrors(prev => [...prev.slice(-4), { // Keep last 5
                message: `Unhandled promise rejection: ${String(event.reason).substring(0, 300)}`,
                timestamp: new Date().toISOString(),
            }]);
        };

        // Override console methods
        console.log = (...args) => {
            captureLog('log', ...args);
            originalConsoleLog(...args);
        };

        console.warn = (...args) => {
            captureLog('warn', ...args);
            originalConsoleWarn(...args);
        };

        console.error = (...args) => {
            captureLog('error', ...args);
            originalConsoleError(...args);
        };

        // Capture unhandled errors
        window.addEventListener('error', captureError);

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', captureRejection);

        // Cleanup
        return () => {
            console.log = originalConsoleLog;
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;
            window.removeEventListener('error', captureError);
            window.removeEventListener('unhandledrejection', captureRejection);
        };
    }, []);

    // Save sessions to localStorage whenever they change
    useEffect(() => {
        saveSessions(sessions);
    }, [sessions]);

    // Save current session ID whenever it changes
    useEffect(() => {
        if (currentSessionId) {
            saveCurrentSessionId(currentSessionId);
        }
    }, [currentSessionId]);

    // Create a new chat session
    const createNewSession = () => {
        const newSession: ChatSession = {
            id: uuidv4(),
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
    };

    // Switch to a different session
    const switchSession = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            setCurrentSessionId(sessionId);
        }
    };

    // Delete a session
    const deleteSession = (sessionId: string) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId));

        if (currentSessionId === sessionId) {
            // Switch to the most recent session or create a new one
            const remainingSessions = sessions.filter(s => s.id !== sessionId);
            if (remainingSessions.length > 0) {
                setCurrentSessionId(remainingSessions[0].id);
            } else {
                createNewSession();
            }
        }
    };

    // Stop the current message generation
    const stopMessage = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
        }
    };

    // Clear current session messages
    const clearCurrentSession = () => {
        if (!currentSessionId) return;

        setSessions(prev =>
            prev.map(session =>
                session.id === currentSessionId
                    ? { ...session, messages: [], updatedAt: new Date() }
                    : session
            )
        );
    };

    // Send a message and get AI response
    const sendMessage = async (message: string) => {
        if (!currentSessionId) {
            createNewSession();
            // Wait for session to be created
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content: message,
            timestamp: new Date(),
        };

        // Add user message immediately
        setSessions(prev =>
            prev.map(session =>
                session.id === (currentSessionId || sessions[0]?.id)
                    ? {
                        ...session,
                        messages: [...session.messages, userMessage],
                        updatedAt: new Date(),
                    }
                    : session
            )
        );

        // Create a placeholder for AI response
        const aiMessageId = uuidv4();
        const aiMessage: Message = {
            id: aiMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
        };

        setSessions(prev =>
            prev.map(session =>
                session.id === (currentSessionId || sessions[0]?.id)
                    ? {
                        ...session,
                        messages: [...session.messages, aiMessage],
                        updatedAt: new Date(),
                    }
                    : session
            )
        );

        setIsLoading(true);
        setError(null);

        // Create abort controller
        const controller = new AbortController();
        setAbortController(controller);

        try {
            // Get current page context
            const currentPath = window.location.pathname;
            const pageTitle = document.title;
            const pageContent = document.body.innerText.substring(0, 1000); // First 1000 chars for context

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ai/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                signal: controller.signal,
                body: JSON.stringify({
                    message,
                    sessionId: currentSessionId || sessions[0]?.id,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        pageContext: {
                            route: currentPath,
                            title: pageTitle,
                            content: pageContent,
                            timestamp: new Date().toISOString(),
                        },
                        debugInfo: {
                            consoleLogs,
                            errors,
                            timestamp: new Date().toISOString(),
                        },
                    },
                }),
            });

            if (!response.ok) {
                if (response.status === 429) {
                    try {
                        const errorData = await response.json();
                        setError(errorData.message || 'Rate limit exceeded. Please try again later.');
                    } catch {
                        setError('Rate limit exceeded. Please try again later.');
                    }
                    // Remove the failed AI message
                    setSessions(prev =>
                        prev.map(session =>
                            session.id === (currentSessionId || sessions[0]?.id)
                                ? {
                                    ...session,
                                    messages: session.messages.filter(msg => msg.id !== aiMessageId),
                                }
                                : session
                        )
                    );
                    return;
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let accumulatedContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'chunk' && data.content) {
                                accumulatedContent += data.content;

                                // Update the AI message with accumulated content
                                setSessions(prev =>
                                    prev.map(session =>
                                        session.id === (currentSessionId || sessions[0]?.id)
                                            ? {
                                                ...session,
                                                messages: session.messages.map(msg =>
                                                    msg.id === aiMessageId
                                                        ? { ...msg, content: accumulatedContent }
                                                        : msg
                                                ),
                                                updatedAt: new Date(),
                                            }
                                            : session
                                    )
                                );
                            } else if (data.type === 'complete') {
                                // Mark streaming as complete
                                setSessions(prev =>
                                    prev.map(session =>
                                        session.id === (currentSessionId || sessions[0]?.id)
                                            ? {
                                                ...session,
                                                messages: session.messages.map(msg =>
                                                    msg.id === aiMessageId
                                                        ? { ...msg, isStreaming: false }
                                                        : msg
                                                ),
                                            }
                                            : session
                                    )
                                );
                            } else if (data.type === 'error') {
                                throw new Error(data.error || 'Unknown error');
                            }
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError);
                        }
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                // Message was stopped, mark as complete
                setSessions(prev =>
                    prev.map(session =>
                        session.id === (currentSessionId || sessions[0]?.id)
                            ? {
                                ...session,
                                messages: session.messages.map(msg =>
                                    msg.id === aiMessageId
                                        ? { ...msg, isStreaming: false }
                                        : msg
                                ),
                            }
                            : session
                    )
                );
            } else {
                console.error('Error sending message:', err);
                setError(err instanceof Error ? err.message : 'Failed to send message');

                // Remove the failed AI message
                setSessions(prev =>
                    prev.map(session =>
                        session.id === (currentSessionId || sessions[0]?.id)
                            ? {
                                ...session,
                                messages: session.messages.filter(msg => msg.id !== aiMessageId),
                            }
                            : session
                    )
                );
            }
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    };

    // Regenerate the last AI message
    const regenerateLastMessage = async () => {
        if (!currentSession || currentSession.messages.length < 2) return;

        const messages = currentSession.messages;
        const lastUserMessage = messages
            .slice()
            .reverse()
            .find(msg => msg.role === 'user');

        if (!lastUserMessage) return;

        // Remove the last AI message
        setSessions(prev =>
            prev.map(session =>
                session.id === currentSessionId
                    ? {
                        ...session,
                        messages: session.messages.slice(0, -1),
                    }
                    : session
            )
        );

        // Resend the last user message
        await sendMessage(lastUserMessage.content);
    };

    return (
        <ChatContext.Provider
            value={{
                currentSession,
                sessions,
                isLoading,
                error,
                createNewSession,
                switchSession,
                deleteSession,
                sendMessage,
                stopMessage,
                clearCurrentSession,
                regenerateLastMessage,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
