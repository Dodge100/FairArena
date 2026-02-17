import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface SidebarItem {
  id: string;
  title: string;
  url: string;
  icon: string;
  badge?: string;
  items?: SidebarItem[];
  visible: boolean;
  order: number;
}

export interface SidebarCustomization {
  mainItems: SidebarItem[];
  secondaryItems: SidebarItem[];
}

interface SidebarCustomizationContextType {
  customization: SidebarCustomization;
  updateItemVisibility: (itemId: string, visible: boolean, isMain: boolean) => void;
  reorderItems: (items: SidebarItem[], isMain: boolean) => void;
  resetToDefault: () => void;
}

const SidebarCustomizationContext = createContext<SidebarCustomizationContextType | null>(null);

const defaultMainItems: SidebarItem[] = [
  { id: 'dashboard', title: 'Dashboard', url: '/dashboard', icon: 'Home', visible: true, order: 0 },
  {
    id: 'projects',
    title: 'Projects',
    url: '/dashboard/projects',
    icon: 'FileText',
    visible: true,
    order: 1,
  },
  {
    id: 'hackathons',
    title: 'Hackathons',
    url: '/dashboard/hackathons',
    icon: 'Trophy',
    visible: true,
    order: 2,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    url: '/dashboard/analytics',
    icon: 'BarChart3',
    visible: true,
    order: 3,
  },
  { id: 'teams', title: 'Teams', url: '/dashboard/teams', icon: 'Users', visible: true, order: 4 },
  {
    id: 'credits',
    title: 'Credits',
    url: '/dashboard/credits',
    icon: 'CreditCard',
    visible: true,
    order: 5,
  },
  { id: 'inbox', title: 'Inbox', url: '/dashboard/inbox', icon: 'Inbox', visible: true, order: 6 },
  {
    id: 'public-profile',
    title: 'Public Profile',
    url: '/dashboard/public-profile',
    icon: 'UserCircle',
    visible: true,
    order: 7,
  },
  {
    id: 'developers',
    title: 'Developers',
    url: '/dashboard/oauth/applications',
    icon: 'Shield',
    visible: true,
    order: 8,
  },
];

const defaultSecondaryItems: SidebarItem[] = [
  {
    id: 'search',
    title: 'Search',
    url: '/dashboard/search',
    icon: 'Search',
    visible: true,
    order: 0,
  },
  {
    id: 'calendar',
    title: 'Calendar',
    url: '/dashboard/calendar',
    icon: 'Calendar',
    visible: true,
    order: 1,
  },
  {
    id: 'settings',
    title: 'Settings',
    url: '/dashboard/account-settings',
    icon: 'Settings',
    visible: true,
    order: 2,
  },
  {
    id: 'help',
    title: 'Help & Support',
    url: '/dashboard/support',
    icon: 'HelpCircle',
    visible: true,
    order: 3,
  },
];

interface SidebarCustomizationProviderProps {
  children: ReactNode;
}

export function SidebarCustomizationProvider({ children }: SidebarCustomizationProviderProps) {
  const [customization, setCustomization] = useState<SidebarCustomization>(() => {
    const saved = localStorage.getItem('sidebarCustomization');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        // Migration: Ensure new default items exist in the saved config

        // 1. Process Main Items
        const savedMainItems = parsed.mainItems || [];
        const savedMainIds = new Set(savedMainItems.map((i: SidebarItem) => i.id));
        const newMainItems = defaultMainItems.filter((i) => !savedMainIds.has(i.id));
        const finalMainItems = [...savedMainItems, ...newMainItems];

        // 2. Process Secondary Items
        const savedSecondaryItems = (parsed.secondaryItems || []).map((item: SidebarItem) => {
          // Update Help URL if it's the old public one
          if (item.id === 'help' && item.url === '/support') {
            return { ...item, url: '/dashboard/support' };
          }
          return item;
        });
        const savedSecondaryIds = new Set(savedSecondaryItems.map((i: SidebarItem) => i.id));
        const newSecondaryItems = defaultSecondaryItems.filter((i) => !savedSecondaryIds.has(i.id));
        const finalSecondaryItems = [...savedSecondaryItems, ...newSecondaryItems];

        return {
          mainItems: finalMainItems,
          secondaryItems: finalSecondaryItems,
        };
      } catch (error) {
        console.warn('Failed to load sidebar customization:', error);
        return {
          mainItems: defaultMainItems,
          secondaryItems: defaultSecondaryItems,
        };
      }
    }
    return {
      mainItems: defaultMainItems,
      secondaryItems: defaultSecondaryItems,
    };
  });

  const isLoaded = true; // Default to true since we load synchronously now

  // Save customization to localStorage whenever it changes (only after initial load)
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('sidebarCustomization', JSON.stringify(customization));
    }
  }, [customization, isLoaded]);

  const updateItemVisibility = (itemId: string, visible: boolean, isMain: boolean) => {
    setCustomization((prev) => ({
      ...prev,
      [isMain ? 'mainItems' : 'secondaryItems']: prev[isMain ? 'mainItems' : 'secondaryItems'].map(
        (item) => (item.id === itemId ? { ...item, visible } : item),
      ),
    }));
  };

  const reorderItems = (items: SidebarItem[], isMain: boolean) => {
    const reorderedItems = items.map((item, index) => ({ ...item, order: index }));
    setCustomization((prev) => ({
      ...prev,
      [isMain ? 'mainItems' : 'secondaryItems']: reorderedItems,
    }));
  };

  const resetToDefault = () => {
    setCustomization({
      mainItems: defaultMainItems,
      secondaryItems: defaultSecondaryItems,
    });
  };

  return (
    <SidebarCustomizationContext.Provider
      value={{
        customization,
        updateItemVisibility,
        reorderItems,
        resetToDefault,
      }}
    >
      {children}
    </SidebarCustomizationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarCustomization() {
  const context = useContext(SidebarCustomizationContext);
  if (!context) {
    throw new Error('useSidebarCustomization must be used within a SidebarCustomizationProvider');
  }
  return context;
}
