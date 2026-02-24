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
import { MFASetup } from '../../../components/MFASetup';
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

// Mock React Query's useMutation
vi.mock('@tanstack/react-query', () => ({
    useMutation: vi.fn(({ mutationFn, onSuccess, onError }) => ({
        mutate: async (data: any) => {
            try {
                const result = await mutationFn(data);
                if (onSuccess) onSuccess(result);
            } catch (err) {
                if (onError) onError(err);
            }
        },
        isPending: false,
    })),
}));

describe('MFASetup Component', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock navigator.clipboard
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockImplementation(() => Promise.resolve()),
            },
        });
        // Mock URL.createObjectURL
        global.URL.createObjectURL = vi.fn();
    });

    it('renders initial setup state', () => {
        render(<MFASetup onComplete={onComplete} onCancel={onCancel} />);
        expect(screen.getByText('Set up Two-Factor Authentication')).toBeDefined();
        expect(screen.getByText('Get Started')).toBeDefined();
    });

    it('transitions to verify step after starting setup', async () => {
        const mockSetupData = {
            success: true,
            data: {
                qrCode: 'data:image/png;base64,mock',
                manualEntryKey: 'MOCK-KEY',
                backupCodes: ['code-1', 'code-2'],
            },
        };
        (apiRequest as any).mockResolvedValueOnce(mockSetupData);

        render(<MFASetup onComplete={onComplete} onCancel={onCancel} />);

        fireEvent.click(screen.getByText('Get Started'));

        await waitFor(() => {
            expect(screen.getByText('Scan QR Code')).toBeDefined();
            expect(screen.getByText('MOCK-KEY')).toBeDefined();
        });
    });

    it('calls onCancel when cancel button is clicked', () => {
        render(<MFASetup onComplete={onComplete} onCancel={onCancel} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onCancel).toHaveBeenCalled();
    });

    it('shows error toast if setup fails', async () => {
        (apiRequest as any).mockRejectedValueOnce(new Error('Failed'));

        render(<MFASetup onComplete={onComplete} onCancel={onCancel} />);
        fireEvent.click(screen.getByText('Get Started'));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Failed to start MFA setup');
        });
    });

    it('transitions to backup codes step after code verification', async () => {
        // 1. Setup step
        (apiRequest as any).mockResolvedValueOnce({
            success: true,
            data: { qrCode: 'qr', manualEntryKey: 'key', backupCodes: ['b1', 'b2'] },
        });

        render(<MFASetup onComplete={onComplete} onCancel={onCancel} />);
        fireEvent.click(screen.getByText('Get Started'));

        // 2. Verify step
        await waitFor(() => screen.getByPlaceholderText('000 000'));
        const input = screen.getByPlaceholderText('000 000');
        fireEvent.change(input, { target: { value: '123456' } });

        (apiRequest as any).mockResolvedValueOnce({ success: true });

        fireEvent.click(screen.getByText('Verify'));

        await waitFor(() => {
            expect(screen.getByText('Setup Complete!')).toBeDefined();
            expect(screen.getByText('b1')).toBeDefined();
            expect(screen.getByText('b2')).toBeDefined();
        });
    });
});
