import { registerBanHandler } from '@/lib/apiClient';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

// Types
export interface User {
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    username?: string | null;
    emailVerified?: boolean;
}

export interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isBanned: boolean; // New prop
    banReason: string | null; // New prop
    login: (email: string, password: string) => Promise<AuthResponse>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => Promise<void>;
    loginWithGoogle: (credential: string) => Promise<void>;
    getToken: () => Promise<string | null>;
    refreshToken: () => Promise<string | null>;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (token: string, password: string) => Promise<void>;
    verifyEmail: (token: string) => Promise<void>;
    verifyLoginMFA: (code: string, isBackupCode?: boolean) => Promise<void>;
}

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface AuthResponse {
    success: boolean;
    message?: string;
    data?: {
        accessToken?: string;
        user?: User;
        isNewUser?: boolean;
    };
    errors?: Record<string, string[]>;
    code?: string;
    mfaRequired?: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const AuthContext = createContext<AuthContextType | null>(null);

// Token storage in memory (more secure than localStorage)
let inMemoryToken: string | null = null;
// Prevent multiple simultaneous refresh calls
let refreshPromise: Promise<string | null> | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBanned, setIsBanned] = useState(false);
    const [banReason, setBanReason] = useState<string | null>(null);

    // Register ban handler
    useEffect(() => {
        registerBanHandler((reason) => {
            setIsBanned(true);
            setBanReason(reason || null);
            // Optionally clear user/token if you want to force a "logged out" state visually,
            // but keeping them might be useful for showing "Banned as [User]".
            // For now, let's keep the user data but the UI will block access.
        });
    }, []);

    // Update both state and memory token
    const updateToken = useCallback((token: string | null) => {
        inMemoryToken = token;
        setAccessToken(token);
    }, []);

    // Refresh the access token (with deduplication to prevent race conditions)
    const refreshToken = useCallback(async (): Promise<string | null> => {
        // If a refresh is already in progress, return the existing promise
        if (refreshPromise) {
            return refreshPromise;
        }

        // Create a new refresh promise
        refreshPromise = (async () => {
            try {
                const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include', // Include cookies
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    updateToken(null);
                    setUser(null);
                    return null;
                }

                const data: AuthResponse = await response.json();

                if (data.success && data.data?.accessToken) {
                    updateToken(data.data.accessToken);
                    return data.data.accessToken;
                }

                return null;
            } catch (error) {
                console.error('Token refresh failed:', error);
                return null;
            } finally {
                // Clear the promise so future calls can start a new refresh
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    }, [updateToken]);

    // Get current user from server
    const fetchCurrentUser = useCallback(async (token: string): Promise<User | null> => {
        try {
            const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Try to refresh
                    const newToken = await refreshToken();
                    if (newToken) {
                        return fetchCurrentUser(newToken);
                    }
                } else if (response.status === 403) {
                    const errorData = await response.json();
                    if (errorData.code === 'USER_BANNED') {
                        setIsBanned(true);
                        setBanReason(errorData.message?.replace('Your account has been suspended. Reason: ', '') || null);
                        return null;
                    }
                }
                return null;
            }

            const data = await response.json();
            return data.success ? data.data : null;
        } catch (error) {
            console.error('Failed to fetch user:', error);
            return null;
        }
    }, [refreshToken]);

    // Initialize auth state on mount
    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);

            // Check URL for token (from OAuth redirect)
            const urlParams = new URLSearchParams(window.location.search);
            const tokenFromUrl = urlParams.get('token');

            if (tokenFromUrl) {
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
                updateToken(tokenFromUrl);

                const userData = await fetchCurrentUser(tokenFromUrl);
                if (userData) {
                    setUser(userData);
                }
            } else {
                // Try to refresh existing session
                const newToken = await refreshToken();
                if (newToken) {
                    const userData = await fetchCurrentUser(newToken);
                    if (userData) {
                        setUser(userData);
                    }
                }
            }

            setIsLoading(false);
        };

        initAuth();
    }, [fetchCurrentUser, refreshToken, updateToken]);

    // Login with email/password
    const login = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
        const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data: AuthResponse = await response.json();

        if (!response.ok || !data.success) {
            if (response.status === 403 && data.code === 'USER_BANNED') {
                setIsBanned(true);
                setBanReason(data.message?.replace('Your account has been suspended. Reason: ', '') || null);
                // Don't throw error, let the UI handle the state change
                return data;
            }
            throw new Error(data.message || 'Login failed');
        }

        if (data.data?.accessToken && data.data?.user) {
            updateToken(data.data.accessToken);
            setUser(data.data.user);
        }

        return data; // Return full response for MFA handling
    }, [updateToken]);

    const verifyLoginMFA = useCallback(async (code: string, isBackupCode?: boolean): Promise<void> => {
        const response = await fetch(`${API_BASE}/api/v1/auth/verify-mfa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies
            body: JSON.stringify({ code, isBackupCode }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            // Handle specific error cases
            if (response.status === 401) {
                throw new Error('Your session has expired. Please sign in again.');
            } else if (response.status === 429) {
                throw new Error(data.message || 'Too many attempts. Please try again later.');
            } else if (response.status === 403 && data.code === 'USER_BANNED') {
                setIsBanned(true);
                setBanReason(data.message?.replace('Your account has been suspended. Reason: ', '') || null);
                return;
            } else {
                throw new Error(data.message || 'MFA verification failed');
            }
        }

        if (data.data?.accessToken && data.data?.user) {
            updateToken(data.data.accessToken);
            setUser(data.data.user);
        }
    }, [updateToken]);

    // Register new user
    const register = useCallback(async (registerData: RegisterData): Promise<void> => {
        const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registerData),
        });

        const data: AuthResponse = await response.json();

        if (!response.ok || !data.success) {
            const errorMessage = data.errors
                ? Object.values(data.errors).flat().join(', ')
                : data.message || 'Registration failed';
            throw new Error(errorMessage);
        }
    }, []);

    // Login with Google credential
    const loginWithGoogle = useCallback(async (credential: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/api/v1/auth/google/token`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ credential }),
        });

        const data: AuthResponse = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Google login failed');
        }

        if (data.data?.accessToken && data.data?.user) {
            updateToken(data.data.accessToken);
            setUser(data.data.user);
        }
    }, [updateToken]);

    // Logout
    const logout = useCallback(async (): Promise<void> => {
        try {
            await fetch(`${API_BASE}/api/v1/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {}),
                },
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            updateToken(null);
            setUser(null);
            setIsBanned(false); // Reset ban state on logout
            setBanReason(null);
        }
    }, [updateToken]);

    // Get token (with auto-refresh if needed)
    const getToken = useCallback(async (): Promise<string | null> => {
        if (inMemoryToken) {
            return inMemoryToken;
        }
        return refreshToken();
    }, [refreshToken]);

    // Forgot password
    const forgotPassword = useCallback(async (email: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const data: AuthResponse = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to send reset email');
        }
    }, []);

    // Reset password
    const resetPassword = useCallback(async (token: string, password: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, password }),
        });

        const data: AuthResponse = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to reset password');
        }
    }, []);

    // Verify email
    const verifyEmail = useCallback(async (token: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/api/v1/auth/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
        });

        const data: AuthResponse = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to verify email');
        }
    }, []);

    const value: AuthContextType = {
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user,
        isBanned,
        banReason,
        login,
        register,
        logout,
        loginWithGoogle,
        getToken,
        refreshToken,
        forgotPassword,
        resetPassword,
        verifyEmail,
        verifyLoginMFA,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Hook for compatibility with existing useAuthState
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function useAuthState() {
    const { user, isLoading, isAuthenticated, getToken, logout } = useAuth();

    return {
        isSignedIn: isAuthenticated,
        isLoaded: !isLoading,
        user: user
            ? {
                id: user.userId,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
                email: user.email,
                profileImageUrl: user.profileImageUrl,
            }
            : null,
        getToken,
        signOut: logout,
    };
}

// Hook for token only
export function useToken() {
    const { getToken } = useAuth();
    return getToken;
}
