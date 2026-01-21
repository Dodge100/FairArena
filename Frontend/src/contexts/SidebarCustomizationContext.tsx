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
        items: [
            { id: 'projects-all', title: 'All Projects', url: '/dashboard/projects/all', icon: '', visible: true, order: 0 },
            { id: 'projects-active', title: 'Active', url: '/dashboard/projects/active', icon: '', visible: true, order: 1 },
            { id: 'projects-completed', title: 'Completed', url: '/dashboard/projects/completed', icon: '', visible: true, order: 2 },
        ]
    },
    { id: 'hackathons', title: 'Hackathons', url: '/dashboard/hackathons', icon: 'Trophy', visible: true, order: 2 },
    { id: 'analytics', title: 'Analytics', url: '/dashboard/analytics', icon: 'BarChart3', visible: true, order: 3 },
    { id: 'teams', title: 'Teams', url: '/dashboard/teams', icon: 'Users', visible: true, order: 4 },
    { id: 'credits', title: 'Credits', url: '/dashboard/credits', icon: 'CreditCard', visible: true, order: 5 },
    { id: 'inbox', title: 'Inbox', url: '/dashboard/inbox', icon: 'Inbox', visible: true, order: 6 },
    { id: 'public-profile', title: 'Public Profile', url: '/dashboard/public-profile', icon: 'UserCircle', visible: true, order: 7 },
    {
        id: 'developers',
        title: 'Developers',
        url: '/dashboard/oauth/applications',
        icon: 'Shield',
        visible: true,
        order: 8,
        items: [
            { id: 'oauth-apps', title: 'My Applications', url: '/dashboard/oauth/applications', icon: '', visible: true, order: 0 },
            { id: 'authorized-apps', title: 'Authorized Apps', url: '/dashboard/oauth/authorized', icon: '', visible: true, order: 1 },
            { id: 'device-auth', title: 'Device Authorization', url: '/dashboard/device', icon: '', visible: true, order: 2 },
        ]
    },
];

const defaultSecondaryItems: SidebarItem[] = [
    { id: 'search', title: 'Search', url: '/dashboard/search', icon: 'Search', visible: true, order: 0 },
    { id: 'calendar', title: 'Calendar', url: '/dashboard/calendar', icon: 'Calendar', visible: true, order: 1 },
    { id: 'settings', title: 'Settings', url: '/dashboard/account-settings', icon: 'Settings', visible: true, order: 2 },
    { id: 'help', title: 'Help & Support', url: '/support', icon: 'HelpCircle', visible: true, order: 3 },
];

interface SidebarCustomizationProviderProps {
    children: ReactNode;
}

export function SidebarCustomizationProvider({ children }: SidebarCustomizationProviderProps) {
    const [customization, setCustomization] = useState<SidebarCustomization>({
        mainItems: defaultMainItems,
        secondaryItems: defaultSecondaryItems,
    });
    const [isLoaded, setIsLoaded] = useState(false);

    // Load customization from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('sidebarCustomization');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);

                // Migration: Ensure new default items exist in the saved config
                // Keep order/visibility from saved, but add missing new defaults
                // Actually, simpler: Use saved if valid, but check for missing IDs

                // We want to preserve user's order and visibility, but append new items
                const savedMainIds = new Set(parsed.mainItems.map((i: SidebarItem) => i.id));
                const newItems = defaultMainItems.filter(i => !savedMainIds.has(i.id));

                const finalMainItems = [...parsed.mainItems, ...newItems];

                // Same for secondary if needed (none added recently)
                const finalSecondaryItems = parsed.secondaryItems || defaultSecondaryItems;

                setCustomization({
                    mainItems: finalMainItems,
                    secondaryItems: finalSecondaryItems
                });
            } catch (error) {
                console.warn('Failed to load sidebar customization:', error);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save customization to localStorage whenever it changes (only after initial load)
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('sidebarCustomization', JSON.stringify(customization));
        }
    }, [customization, isLoaded]);

    const updateItemVisibility = (itemId: string, visible: boolean, isMain: boolean) => {
        setCustomization(prev => ({
            ...prev,
            [isMain ? 'mainItems' : 'secondaryItems']: prev[isMain ? 'mainItems' : 'secondaryItems'].map(item =>
                item.id === itemId ? { ...item, visible } : item
            ),
        }));
    };

    const reorderItems = (items: SidebarItem[], isMain: boolean) => {
        const reorderedItems = items.map((item, index) => ({ ...item, order: index }));
        setCustomization(prev => ({
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
