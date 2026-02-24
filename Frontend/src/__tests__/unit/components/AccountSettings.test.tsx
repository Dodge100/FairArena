/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountSettingsComponent from '../../../components/AccountSettings';
import { apiRequest } from '../../../lib/apiClient';

import { MemoryRouter } from 'react-router-dom';

// Mock lucide-react
vi.mock('lucide-react', () => ({
    Activity: () => <div data-testid="icon-activity" />,
    Bell: () => <div data-testid="icon-bell" />,
    ChevronDown: () => <div data-testid="icon-chevron-down" />,
    ChevronUp: () => <div data-testid="icon-chevron-up" />,
    Cookie: () => <div data-testid="icon-cookie" />,
    Download: () => <div data-testid="icon-download" />,
    Layout: () => <div data-testid="icon-layout" />,
    Loader2: () => <div data-testid="icon-loader" />,
    Search: () => <div data-testid="icon-search" />,
    Settings: () => <div data-testid="icon-settings" />,
    Shield: () => <div data-testid="icon-shield" />,
    Smartphone: () => <div data-testid="icon-smartphone" />,
    Check: () => <div data-testid="icon-check" />,
    Copy: () => <div data-testid="icon-copy" />,
    BarChart3: () => <div data-testid="icon-barchart" />,
    Lock: () => <div data-testid="icon-lock" />,
    Monitor: () => <div data-testid="icon-monitor" />,
    Rocket: () => <div data-testid="icon-rocket" />,
    Globe: () => <div data-testid="icon-globe" />,
    X: () => <div data-testid="icon-x" />,
    AlertTriangle: () => <div data-testid="icon-alert" />,
}));

// Mock dependencies
vi.mock('../../../lib/apiClient', () => ({
    apiRequest: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../../hooks/useTheme', () => ({
    useTheme: () => ({ isDark: false }),
}));

// Mock sub-components
vi.mock('../../../components/ItemListModal', () => ({
    ItemListModal: () => <div data-testid="item-list-modal" />,
}));
vi.mock('../../../components/SidebarCustomizationModal', () => ({
    SidebarCustomizationModal: () => <div data-testid="sidebar-customization-modal" />,
}));
vi.mock('../components/CookieConsentModal', () => ({
    CookieConsentModal: () => <div data-testid="cookie-consent-modal" />,
}));
vi.mock('./auth/QRScannerDialog', () => ({
    QRScannerDialog: () => <div data-testid="qr-scanner-dialog" />,
}));


vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(),
    };
});

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
        nav: ({ children, ...props }: any) => <nav {...props}>{children}</nav>,
        h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
        h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
        h3: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
        p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
        section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
        article: ({ children, ...props }: any) => <article {...props}>{children}</article>,
        header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
        footer: ({ children, ...props }: any) => <footer {...props}>{children}</footer>,
        main: ({ children, ...props }: any) => <main {...props}>{children}</main>,
        ul: ({ children, ...props }: any) => <ul {...props}>{children}</ul>,
        li: ({ children, ...props }: any) => <li {...props}>{children}</li >,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Contexts
vi.mock('../../../contexts/DataSaverContext', () => ({
    useDataSaver: () => ({
        dataSaverSettings: { enabled: false },
        updateDataSaverSetting: vi.fn(),
    }),
}));

vi.mock('../../../contexts/CookieConsentContext', () => ({
    useCookieConsent: () => ({
        consentSettings: {},
        acceptAll: vi.fn(),
        rejectAll: vi.fn(),
        updateConsent: vi.fn(),
    }),
}));

vi.mock('../../../contexts/SidebarCustomizationContext', () => ({
    useSidebarCustomization: () => ({
        customization: { mainItems: [], secondaryItems: [] },
        resetToDefault: vi.fn(),
    }),
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => {
    return {
        useQuery: vi.fn(({ queryKey }) => {
            if (queryKey[0] === 'account-settings') {
                return { data: { wantToGetFeedbackMail: true }, isLoading: false };
            }
            return { data: null, isLoading: false };
        }),
        useMutation: vi.fn(({ mutationFn, onSuccess }) => ({
            mutate: async (vars: any, options: any = {}) => {
                try {
                    const res = await mutationFn(vars);
                    if (onSuccess) onSuccess(res, vars);
                    if (options.onSuccess) options.onSuccess(res, vars);
                    return res;
                } catch (err) {
                    if (options.onError) options.onError(err);
                    throw err;
                }
            },
            isPending: false,
        })),
        useQueryClient: () => ({
            cancelQueries: vi.fn(),
            setQueryData: vi.fn(),
            getQueryData: vi.fn(),
            invalidateQueries: vi.fn(),
        }),
    };
});

describe('AccountSettingsComponent', () => {
    const renderComponent = () => {
        return render(
            <MemoryRouter>
                <AccountSettingsComponent />
            </MemoryRouter>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly with sections', () => {
        renderComponent();
        expect(screen.getByText('Account Settings')).toBeDefined();
        expect(screen.getByText('Activity & Support')).toBeDefined();
        expect(screen.getByText('General Preferences')).toBeDefined();
        expect(screen.getByText('Security')).toBeDefined();
    });

    it('handles "Disable Home Page" toggle', () => {
        renderComponent();
        const switch_ = screen.getByLabelText('Disable Home Page');
        fireEvent.click(switch_);
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Home page'));
    });


    it('shows error if data export confirmation text is wrong', () => {
        render(<AccountSettingsComponent />);
        const input = screen.getByPlaceholderText(/Type "CONFIRM EXPORT MY DATA" to proceed/i);
        fireEvent.change(input, { target: { value: 'WRONG' } });

        const exportButton = screen.getByText('Type Confirmation Text');
        expect(exportButton).toBeDefined();
        // Button should be disabled (or showing help text)
    });

    it('initiates data export when correct text is entered', async () => {
        (apiRequest as any).mockResolvedValueOnce({ success: true });

        render(<AccountSettingsComponent />);
        const input = screen.getByPlaceholderText(/Type "CONFIRM EXPORT MY DATA" to proceed/i);
        fireEvent.change(input, { target: { value: 'CONFIRM EXPORT MY DATA' } });

        const exportButton = screen.getByText('Export My Data');
        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(screen.getByText(/Data export initiated!/)).toBeDefined();
        });
    });

    it('handles section search', () => {
        render(<AccountSettingsComponent />);
        const searchInput = screen.getByPlaceholderText('Search settings...');
        fireEvent.change(searchInput, { target: { value: 'security' } });

        // Non-matching sections should be hidden or filtered
        expect(screen.queryByText('Communication')).toBeNull();
        expect(screen.getByText('Security')).toBeDefined();
    });
});
