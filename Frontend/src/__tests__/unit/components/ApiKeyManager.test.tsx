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

import { useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyManager } from '../../../components/ApiKeyManager';
import { apiRequest } from '../../../lib/apiClient';

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

vi.mock('lucide-react', () => ({
    Key: () => <div data-testid="icon-key" />,
    Plus: () => <div data-testid="icon-plus" />,
    Trash2: () => <div data-testid="icon-trash" />,
    Loader2: () => <div data-testid="icon-loader" />,
    Check: () => <div data-testid="icon-check" />,
    Copy: () => <div data-testid="icon-copy" />,
    X: () => <div data-testid="icon-x" />,
    AlertTriangle: () => <div data-testid="icon-alert" />,
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => {
    return {
        useQuery: vi.fn(),
        useMutation: vi.fn(({ mutationFn, onSuccess, onError }) => ({
            mutate: async (data: any, options: any = {}) => {
                try {
                    const result = await mutationFn(data);
                    if (onSuccess) onSuccess(result, data);
                    if (options.onSuccess) options.onSuccess(result, data);
                    if (options.onSettled) options.onSettled(result, null, data);
                } catch (err) {
                    if (onError) onError(err);
                    if (options.onError) options.onError(err);
                    if (options.onSettled) options.onSettled(null, err, data);
                }
            },
            isPending: false,
        })),
        useQueryClient: () => ({
            invalidateQueries: vi.fn(),
        }),
    };
});

describe('ApiKeyManager Component', () => {
    const renderComponent = () => {
        return render(<ApiKeyManager />);
    };

    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockImplementation(() => Promise.resolve()),
            },
        });
    });

    it('renders loading state initially', () => {
        (useQuery as any).mockReturnValue({ data: [], isLoading: true });
        renderComponent();
        expect(screen.getByTestId('icon-loader')).toBeDefined();
    });

    it('renders list of API keys', async () => {
        const mockKeys = [
            { id: '1', name: 'Test Key', keyPrefix: 'test_', createdAt: new Date().toISOString(), lastUsedAt: null, expiresAt: null },
        ];
        (useQuery as any).mockReturnValue({ data: mockKeys, isLoading: false });

        renderComponent();

        expect(screen.getByText('Test Key')).toBeDefined();
        expect(screen.getByText('test_')).toBeDefined();
        expect(screen.getByTestId('icon-trash')).toBeDefined();
    });

    it('handles "Create New Key" modal flow', async () => {
        (useQuery as any).mockReturnValue({ data: [], isLoading: false });
        (apiRequest as any).mockResolvedValue({ success: true, data: { keys: [] } });

        renderComponent();

        fireEvent.click(screen.getByText('Create New Key'));
        expect(screen.getByText('Create New API Key')).toBeDefined();

        const input = screen.getByPlaceholderText(/e.g. Production Server/i);
        fireEvent.change(input, { target: { value: 'New Key' } });

        const createButton = screen.getByText('Create Key');

        (apiRequest as any).mockResolvedValueOnce({
            success: true,
            data: { id: '2', name: 'New Key', key: 'test_full_key', expiresAt: null }
        });

        fireEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText('API Key Created')).toBeDefined();
            expect(screen.getByText('test_full_key')).toBeDefined();
        });
    });

    it('handles key revocation', async () => {
        const mockKeys = [
            { id: '1', name: 'To Revoke', keyPrefix: 'rev_', createdAt: new Date().toISOString(), lastUsedAt: null, expiresAt: null },
        ];
        (useQuery as any).mockReturnValue({ data: mockKeys, isLoading: false });
        (apiRequest as any).mockResolvedValue({ success: true, data: { keys: mockKeys } });

        renderComponent();

        await waitFor(() => expect(screen.queryByTestId('icon-trash')).not.toBeNull());

        fireEvent.click(screen.getByTestId('icon-trash'));

        await waitFor(() => expect(screen.getByText(/Are you sure you want to revoke/i)).toBeDefined());

        const revokeConfirmButton = screen.getByText('Revoke Key');
        (apiRequest as any).mockResolvedValue({ success: true });

        fireEvent.click(revokeConfirmButton);

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('API key revoked successfully');
        });
    });
});
