import { apiFetch } from '@/lib/apiClient';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

type OnboardingStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

interface OnboardingContextValue {
    status: OnboardingStatus;
    version: number;
    currentStep: number;
    isLoading: boolean;
    completeOnboarding: () => Promise<void>;
    skipOnboarding: () => Promise<void>;
    trackStep: (step: number) => Promise<void>;
    setCurrentStep: (step: number) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [status, setStatus] = useState<OnboardingStatus>('PENDING');
    const [version, setVersion] = useState<number>(1);
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Fetch onboarding status on mount if authenticated
    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated) {
            setIsLoading(false);
            return;
        }

        const fetchStatus = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
                const response = await apiFetch(`${apiUrl}/api/v1/onboarding/status`, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setStatus(data.data.status);
                        setVersion(data.data.version);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch onboarding status:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatus();
    }, [isAuthenticated, authLoading]);

    const completeOnboarding = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
            const response = await apiFetch(`${apiUrl}/api/v1/onboarding/complete`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setStatus('COMPLETED');
                    toast.success('Welcome to FairArena! 🎉');
                }
            } else {
                throw new Error('Failed to complete onboarding');
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
            toast.error('Failed to complete onboarding');
            throw error;
        }
    };

    const skipOnboarding = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
            const response = await apiFetch(`${apiUrl}/api/v1/onboarding/skip`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setStatus('SKIPPED');
                }
            } else {
                throw new Error('Failed to skip onboarding');
            }
        } catch (error) {
            console.error('Error skipping onboarding:', error);
            toast.error('Failed to skip onboarding');
            throw error;
        }
    };

    const trackStep = async (step: number) => {
        // Fire-and-forget - don't block UI
        void (async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
                await apiFetch(`${apiUrl}/api/v1/onboarding/progress`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ step }),
                });
            } catch (error) {
                console.error('Error tracking onboarding step:', error);
                // Don't throw - tracking is best-effort
            }
        })();
    };

    const value: OnboardingContextValue = {
        status,
        version,
        currentStep,
        isLoading,
        completeOnboarding,
        skipOnboarding,
        trackStep,
        setCurrentStep,
    };

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (context === undefined) {
        throw new Error('useOnboarding must be used within an OnboardingProvider');
    }
    return context;
}
