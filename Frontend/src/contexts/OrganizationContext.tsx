import { apiRequest } from '@/lib/apiClient';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuthState } from '../lib/auth';

interface Organization {
  id: string;
  name: string;
  slug: string;
  joinEnabled: boolean;
  isPublic: boolean;
  timezone?: string;
  createdAt: string;
  memberCount: number;
  teamCount: number;
  userRole: {
    id: string;
    name: string;
    permissions: Record<string, unknown>;
  };
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  loading: boolean;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider = ({ children }: OrganizationProviderProps) => {
  const { isSignedIn } = useAuthState();
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);

  const { data: organizations = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      if (!isSignedIn) return [];
      const data = await apiRequest<{ organizations: Organization[] }>(`${API_BASE}/api/v1/organization`);
      return data.organizations || [];
    },
    enabled: isSignedIn,
  });

  useEffect(() => {
    if (organizations.length > 0 && !currentOrganization) {
      setCurrentOrganizationState(organizations[0]);
    } else if (organizations.length === 0) {
      setCurrentOrganizationState(null);
    }
  }, [organizations, currentOrganization]);

  const setCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganizationState(org);
  };

  const refreshOrganizations = async () => {
    await refetch();
  };

  const value: OrganizationContextType = {
    organizations,
    currentOrganization,
    setCurrentOrganization,
    loading,
    refreshOrganizations,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};
