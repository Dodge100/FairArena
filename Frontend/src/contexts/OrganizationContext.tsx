import { apiFetch } from '@/lib/apiClient';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { getToken, isSignedIn } = useAuthState();

  const fetchOrganizations = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      const response = await apiFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/organization`);
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations);

        // Set current organization to first or null
        setCurrentOrganizationState(data.organizations[0] || null);
      } else {
        toast.error('Failed to load organizations');
      }
    } catch (error) {
      toast.error('An error occurred while loading organizations');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getToken]);

  const setCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganizationState(org);
  };

  const refreshOrganizations = async () => {
    setLoading(true);
    await fetchOrganizations();
  };

  useEffect(() => {
    fetchOrganizations();
  }, [isSignedIn, fetchOrganizations]);

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
