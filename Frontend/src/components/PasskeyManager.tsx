import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest, publicApiFetch } from '@/lib/apiClient';
import {
    browserSupportsWebAuthn,
    startAuthentication,
    startRegistration,
} from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertCircle,
    Fingerprint,
    Key,
    Loader2,
    MoreVertical,
    Pencil,
    Plus,
    Smartphone,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Passkey {
    id: string;
    name: string | null;
    deviceType: string | null;
    createdAt: string;
    lastUsedAt: string | null;
}

interface PasskeyManagerProps {
    onPasskeyChange?: () => void;
}

export function PasskeyManager({ onPasskeyChange }: PasskeyManagerProps) {
    const [registering, setRegistering] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [isSupported, setIsSupported] = useState(true);
    const [showDropdown, setShowDropdown] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    // Check WebAuthn support
    useEffect(() => {
        setIsSupported(browserSupportsWebAuthn());
    }, []);

    // Fetch passkeys
    const { data: passkeys = [], isLoading: loading } = useQuery({
        queryKey: ['passkeys'],
        queryFn: () => apiRequest<{ success: boolean; data: Passkey[] }>(`${apiUrl}/api/v1/passkeys`)
            .then(res => res.data),
        staleTime: 60000,
    });

    // Register new passkey
    const registerMutation = useMutation({
        mutationFn: async () => {
            const optionsRes = await apiRequest<{ success: boolean; data: any; message?: string }>(
                `${apiUrl}/api/v1/passkeys/register/options`,
                { method: 'POST' }
            );

            if (!optionsRes.success) {
                throw new Error(optionsRes.message || 'Failed to get registration options');
            }

            const credential = await startRegistration({
                optionsJSON: optionsRes.data as PublicKeyCredentialCreationOptionsJSON,
            });

            const verifyRes = await apiRequest<{ success: boolean; message?: string }>(
                `${apiUrl}/api/v1/passkeys/register/verify`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ response: credential }),
                }
            );

            if (!verifyRes.success) {
                throw new Error(verifyRes.message || 'Failed to verify registration');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['passkeys'] });
            toast.success('Passkey registered successfully!');
            onPasskeyChange?.();
        },
        onError: (error: any) => {
            const message = error instanceof Error ? error.message : 'Failed to register passkey';
            if (message.includes('cancelled') || message.includes('canceled') || message.includes('AbortError')) {
                toast.info('Passkey registration cancelled');
            } else {
                toast.error(message);
            }
        },
    });

    const handleRegister = async () => {
        if (!isSupported) {
            toast.error('Passkeys are not supported in this browser');
            return;
        }
        setRegistering(true);
        try {
            await registerMutation.mutateAsync();
        } finally {
            setRegistering(false);
        }
    };

    // Delete passkey
    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequest(`${apiUrl}/api/v1/passkeys/${id}`, { method: 'DELETE' }),
        onMutate: (id) => {
            setDeletingId(id);
        },
        onSettled: () => {
            setDeletingId(null);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['passkeys'] });
            toast.success('Passkey deleted');
            onPasskeyChange?.();
        },
        onError: (error: any) => {
            toast.error(error instanceof Error ? error.message : 'Failed to delete passkey');
        },
    });

    const handleDelete = (id: string) => {
        setShowDropdown(null);
        deleteMutation.mutate(id);
    };

    // Start rename
    const startRename = (passkey: Passkey) => {
        setRenamingId(passkey.id);
        setNewName(passkey.name || '');
        setShowDropdown(null);
    };

    // Save rename
    const renameMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) =>
            apiRequest<{ success: boolean; message?: string }>(`${apiUrl}/api/v1/passkeys/${id}/rename`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['passkeys'] });
            setRenamingId(null);
            setNewName('');
            toast.success('Passkey renamed');
        },
        onError: (error: any) => {
            toast.error(error instanceof Error ? error.message : 'Failed to rename passkey');
        },
    });

    const handleRename = (id: string) => {
        if (!newName.trim()) {
            toast.error('Name cannot be empty');
            return;
        }
        renameMutation.mutate({ id, name: newName.trim() });
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Get device icon
    const getDeviceIcon = (deviceType: string | null) => {
        if (deviceType === 'platform') {
            return <Fingerprint className="w-5 h-5" />;
        }
        return <Key className="w-5 h-5" />;
    };

    // Browser not supported
    if (!isSupported) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Fingerprint className="w-5 h-5" />
                        Passkeys
                    </CardTitle>
                    <CardDescription>
                        Sign in without a password using your device's biometrics or security key.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 dark:text-yellow-500">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p className="text-sm">
                            Passkeys are not supported in this browser. Please use a modern browser like Chrome, Safari, Edge, or Firefox.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Fingerprint className="w-5 h-5 text-primary" />
                            Passkeys
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Sign in securely without a password using Face ID, Touch ID, Windows Hello, or a security key.
                        </CardDescription>
                    </div>
                    <Button
                        onClick={handleRegister}
                        disabled={registering}
                        size="sm"
                        className="shrink-0"
                    >
                        {registering ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <Plus className="w-4 h-4 mr-2" />
                        )}
                        Add Passkey
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : passkeys.length === 0 ? (
                    <div className="text-center py-8 space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                            <Smartphone className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-medium">No passkeys registered</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Add a passkey to sign in faster and more securely without entering your password.
                            </p>
                        </div>
                        <Button onClick={handleRegister} disabled={registering} variant="outline">
                            {registering ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Create your first passkey
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {passkeys.map((passkey) => (
                            <div
                                key={passkey.id}
                                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        {getDeviceIcon(passkey.deviceType)}
                                    </div>
                                    <div>
                                        {renamingId === passkey.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRename(passkey.id);
                                                        if (e.key === 'Escape') {
                                                            setRenamingId(null);
                                                            setNewName('');
                                                        }
                                                    }}
                                                    className="px-2 py-1 text-sm border rounded-md bg-background"
                                                    autoFocus
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleRename(passkey.id)}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setRenamingId(null);
                                                        setNewName('');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="font-medium">
                                                    {passkey.name || 'Unnamed Passkey'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Created {formatDate(passkey.createdAt)}
                                                    {passkey.lastUsedAt && ` • Last used ${formatDate(passkey.lastUsedAt)}`}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {renamingId !== passkey.id && (
                                    <div className="relative">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => setShowDropdown(showDropdown === passkey.id ? null : passkey.id)}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>

                                        {showDropdown === passkey.id && (
                                            <div className="absolute right-0 top-full mt-1 w-36 py-1 bg-popover border rounded-md shadow-lg z-10">
                                                <button
                                                    onClick={() => startRename(passkey)}
                                                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(passkey.id)}
                                                    disabled={deletingId === passkey.id}
                                                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-red-500"
                                                >
                                                    {deletingId === passkey.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Hook to check if passkeys are supported
 */
export function usePasskeySupport() {
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        setIsSupported(browserSupportsWebAuthn());
    }, []);

    return isSupported;
}

/**
 * Initiate passkey login flow
 * Call this from the signin page
 */
/**
 * Hook to handle passkey login flow
 */
export function usePasskeyLogin() {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    return useMutation({
        mutationFn: async (email?: string) => {
            // Step 1: Get authentication options
            const optionsRes = await publicApiFetch(`${apiUrl}/api/v1/passkeys/login/options`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const optionsData = await optionsRes.json();

            if (!optionsData.success) {
                throw new Error(optionsData.message || 'Failed to get authentication options');
            }

            // Step 2: Authenticate with browser
            const credential = await startAuthentication({
                optionsJSON: optionsData.data,
            });

            // Step 3: Verify with server
            const verifyRes = await publicApiFetch(`${apiUrl}/api/v1/passkeys/login/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: credential }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyData.success) {
                throw new Error(verifyData.message || 'Failed to verify authentication');
            }

            return {
                user: verifyData.data.user,
                accessToken: verifyData.data.accessToken,
            };
        }
    });
}

/**
 * Helper to handle passkey login flow (non-hook version)
 */
export async function initiatePasskeyLogin(apiUrl: string, email?: string) {
    try {
        // Step 1: Get authentication options
        const optionsRes = await publicApiFetch(`${apiUrl}/api/v1/passkeys/login/options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const optionsData = await optionsRes.json();

        if (!optionsData.success) {
            return { success: false, error: optionsData.message || 'Failed to get authentication options' };
        }

        // Step 2: Authenticate with browser
        const credential = await startAuthentication({
            optionsJSON: optionsData.data,
        });

        // Step 3: Verify with server
        const verifyRes = await publicApiFetch(`${apiUrl}/api/v1/passkeys/login/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response: credential }),
        });
        const verifyData = await verifyRes.json();

        if (!verifyData.success) {
            return { success: false, error: verifyData.message || 'Failed to verify authentication' };
        }

        return {
            success: true,
            user: verifyData.data.user,
            accessToken: verifyData.data.accessToken,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Passkey authentication failed';
        if (message.includes('cancelled') || message.includes('canceled') || message.includes('AbortError')) {
            return { success: false, error: 'cancelled' };
        }
        return { success: false, error: message };
    }
}
