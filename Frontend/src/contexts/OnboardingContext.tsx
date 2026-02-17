import { apiRequest } from '@/lib/apiClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  const queryClient = useQueryClient();

  const { data: onboardingData, isLoading: queryLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () =>
      apiRequest<{ success: boolean; data: { status: OnboardingStatus; version: number } }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/onboarding/status`,
      ),
    enabled: isAuthenticated && !authLoading,
  });

  useEffect(() => {
    if (onboardingData?.success) {
      setStatus(onboardingData.data.status);
      setVersion(onboardingData.data.version);
    }
  }, [onboardingData]);

  useEffect(() => {
    setIsLoading(queryLoading || authLoading);
  }, [queryLoading, authLoading]);

  const completeMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/onboarding/complete`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    onSuccess: () => {
      setStatus('COMPLETED');
      toast.success('Welcome to FairArena! 🎉');
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
    onError: () => {
      toast.error('Failed to complete onboarding');
    },
  });

  const completeOnboarding = async () => {
    await completeMutation.mutateAsync();
  };

  const skipMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/onboarding/skip`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    onSuccess: () => {
      setStatus('SKIPPED');
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
    onError: () => {
      toast.error('Failed to skip onboarding');
    },
  });

  const skipOnboarding = async () => {
    await skipMutation.mutateAsync();
  };

  const trackStepMutation = useMutation({
    mutationFn: (step: number) =>
      apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/onboarding/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      }),
  });

  const trackStep = async (step: number) => {
    trackStepMutation.mutate(step);
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

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
