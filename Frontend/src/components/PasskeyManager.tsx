import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/apiClient';
import {
    browserSupportsWebAuthn,
    startAuthentication,
    startRegistration,
} from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types';
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
import { useCallback, useEffect, useState } from 'react';
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
    const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [isSupported, setIsSupported] = useState(true);
    const [showDropdown, setShowDropdown] = useState<string | null>(null);

    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    // Check WebAuthn support
    useEffect(() => {
        setIsSupported(browserSupportsWebAuthn());
    }, []);

    // Fetch passkeys
    const fetchPasskeys = useCallback(async () => {
        try {
            const res = await apiFetch(`${apiUrl}/api/v1/passkeys`);
            const data = await res.json();
            if (data.success) {
                setPasskeys(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch passkeys:', error);
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => {
        fetchPasskeys();
    }, [fetchPasskeys]);

    // Register new passkey
    const handleRegister = async () => {
        if (!isSupported) {
            toast.error('Passkeys are not supported in this browser');
            return;
        }

        setRegistering(true);
        try {
            // Step 1: Get registration options from server
            const optionsRes = await apiFetch(`${apiUrl}/api/v1/passkeys/register/options`, {
                method: 'POST',
            });
            const optionsData = await optionsRes.json();

            if (!optionsData.success) {
                throw new Error(optionsData.message || 'Failed to get registration options');
            }

            // Step 2: Create credential with browser WebAuthn API
            const credential = await startRegistration({
                optionsJSON: optionsData.data as PublicKeyCredentialCreationOptionsJSON,
            });

            // Step 3: Verify and save the credential
            const verifyRes = await apiFetch(`${apiUrl}/api/v1/passkeys/register/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: credential }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyData.success) {
                throw new Error(verifyData.message || 'Failed to verify registration');
            }

            toast.success('Passkey registered successfully!');
            fetchPasskeys();
            onPasskeyChange?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to register passkey';
            // Handle user cancellation gracefully
            if (message.includes('cancelled') || message.includes('canceled') || message.includes('AbortError')) {
                toast.info('Passkey registration cancelled');
            } else {
                toast.error(message);
            }
        } finally {
            setRegistering(false);
        }
    };

    // Delete passkey
    const handleDelete = async (id: string) => {
        setDeletingId(id);
        setShowDropdown(null);
        try {
            const res = await apiFetch(`${apiUrl}/api/v1/passkeys/${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to delete passkey');
            }

            toast.success('Passkey deleted');
            setPasskeys(prev => prev.filter(p => p.id !== id));
            onPasskeyChange?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete passkey';
            toast.error(message);
        } finally {
            setDeletingId(null);
        }
    };

    // Start rename
    const startRename = (passkey: Passkey) => {
        setRenamingId(passkey.id);
        setNewName(passkey.name || '');
        setShowDropdown(null);
    };

    // Save rename
    const handleRename = async (id: string) => {
        if (!newName.trim()) {
            toast.error('Name cannot be empty');
            return;
        }

        try {
            const res = await apiFetch(`${apiUrl}/api/v1/passkeys/${id}/rename`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() }),
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to rename passkey');
            }

            toast.success('Passkey renamed');
            setPasskeys(prev => prev.map(p => p.id === id ? { ...p, name: newName.trim() } : p));
            setRenamingId(null);
            setNewName('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to rename passkey';
            toast.error(message);
        }
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
export async function initiatePasskeyLogin(apiUrl: string, email?: string): Promise<{
    success: boolean;
    user?: {
        userId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        profileImageUrl: string | null;
        emailVerified: boolean;
        mfaEnabled: boolean;
    };
    accessToken?: string;
    error?: string;
}> {
    try {
        // Step 1: Get authentication options
        const optionsRes = await fetch(`${apiUrl}/api/v1/passkeys/login/options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email }),
        });
        const optionsData = await optionsRes.json();

        if (!optionsData.success) {
            throw new Error(optionsData.message || 'Failed to get authentication options');
        }

        // Step 2: Authenticate with browser WebAuthn API
        const credential = await startAuthentication({
            optionsJSON: optionsData.data,
        });

        // Step 3: Verify with server
        const verifyRes = await fetch(`${apiUrl}/api/v1/passkeys/login/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ response: credential }),
        });
        const verifyData = await verifyRes.json();

        if (!verifyData.success) {
            throw new Error(verifyData.message || 'Failed to verify authentication');
        }

        return {
            success: true,
            user: verifyData.data.user,
            accessToken: verifyData.data.accessToken,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Passkey authentication failed';
        // Check if it's a cancellation
        if (message.includes('cancelled') || message.includes('canceled') || message.includes('AbortError')) {
            return { success: false, error: 'cancelled' };
        }
        return { success: false, error: message };
    }
}
