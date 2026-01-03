import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/apiClient';
import {
    browserSupportsWebAuthn,
    startRegistration,
} from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types';
import {
    Fingerprint,
    Key,
    Loader2,
    MoreVertical,
    Pencil,
    Plus,
    ShieldCheck,
    Trash2
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SecurityKey {
    id: string;
    name: string | null;
    deviceType: string | null;
    createdAt: string;
    lastUsedAt: string | null;
}

interface SecurityKeyManagerProps {
    onDeviceChange?: () => void;
}

export function SecurityKeyManager({ onDeviceChange }: SecurityKeyManagerProps) {
    const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([]);
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

    // Fetch registered security keys
    const fetchSecurityKeys = useCallback(async () => {
        try {
            const res = await apiFetch(`${apiUrl}/api/v1/mfa/webauthn/devices`);
            const data = await res.json();
            if (data.success) {
                setSecurityKeys(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch security keys:', error);
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => {
        fetchSecurityKeys();
    }, [fetchSecurityKeys]);

    // Register new security key
    const handleRegister = async () => {
        if (!isSupported) {
            toast.error('Security keys are not supported in this browser');
            return;
        }

        setRegistering(true);
        try {
            // Step 1: Get registration options
            const optionsRes = await apiFetch(`${apiUrl}/api/v1/mfa/webauthn/register/options`, {
                method: 'POST',
            });
            const optionsData = await optionsRes.json();

            if (!optionsData.success) {
                throw new Error(optionsData.message || 'Failed to get registration options');
            }

            // Step 2: Create credential
            const credential = await startRegistration({
                optionsJSON: optionsData.data as PublicKeyCredentialCreationOptionsJSON,
            });

            // Step 3: Verify and save
            const verifyRes = await apiFetch(`${apiUrl}/api/v1/mfa/webauthn/register/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: credential }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyData.success) {
                throw new Error(verifyData.message || 'Failed to verify registration');
            }

            toast.success('Security key added successfully!');
            fetchSecurityKeys();
            onDeviceChange?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to register security key';
            if (message.includes('cancelled') || message.includes('canceled') || message.includes('AbortError')) {
                toast.info('Registration cancelled');
            } else {
                toast.error(message);
            }
        } finally {
            setRegistering(false);
        }
    };

    // Delete security key
    const handleDelete = async (id: string) => {
        setDeletingId(id);
        setShowDropdown(null);
        try {
            const res = await apiFetch(`${apiUrl}/api/v1/mfa/webauthn/devices/${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to remove security key');
            }

            toast.success('Security key removed');
            setSecurityKeys(prev => prev.filter(k => k.id !== id));
            onDeviceChange?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete security key');
        } finally {
            setDeletingId(null);
        }
    };

    // Rename methods
    const startRename = (key: SecurityKey) => {
        setRenamingId(key.id);
        setNewName(key.name || '');
        setShowDropdown(null);
    };

    const handleRename = async (id: string) => {
        if (!newName.trim()) {
            toast.error('Name cannot be empty');
            return;
        }

        try {
            const res = await apiFetch(`${apiUrl}/api/v1/mfa/webauthn/devices/${id}/rename`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() }),
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.message);

            toast.success('Security key renamed');
            setSecurityKeys(prev => prev.map(k => k.id === id ? { ...k, name: newName.trim() } : k));
            setRenamingId(null);
        } catch (error) {
            toast.error('Failed to rename security key');
        }
    };

    // Helper functions
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getDeviceIcon = (deviceType: string | null) => {
        return deviceType === 'platform' ? <Fingerprint className="w-5 h-5" /> : <Key className="w-5 h-5" />;
    };

    if (!isSupported) return null;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            Security Keys
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Use a physical security key (YubiKey, Titan Key) or biometric sensor (fingerprint, Face ID) as an unphishable second factor.
                        </CardDescription>
                    </div>
                    <Button
                        onClick={handleRegister}
                        disabled={registering}
                        size="sm"
                        className="shrink-0"
                    >
                        {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Add Key
                    </Button>
                </div>
                {/* Security key benefit banner */}
                <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-primary font-medium flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Strongest Protection Available
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        When you add a security key, it becomes the <strong>only</strong> way to verify new devices.
                        Email and notification codes will be disabled for maximum security.
                    </p>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : securityKeys.length === 0 ? (
                    <div className="text-center py-8 space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                            <Key className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-medium">No security keys configured</p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                                Security keys provide the highest level of protection against phishing and account takeover.
                                They work with USB keys (YubiKey), phones (passkeys), or built-in biometrics.
                            </p>
                        </div>
                        <Button onClick={handleRegister} disabled={registering} variant="outline">
                            {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Add Your First Security Key
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {securityKeys.map((key) => (
                            <div key={key.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        {getDeviceIcon(key.deviceType)}
                                    </div>
                                    <div>
                                        {renamingId === key.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRename(key.id);
                                                        if (e.key === 'Escape') setRenamingId(null);
                                                    }}
                                                    className="px-2 py-1 text-sm border rounded-md bg-background"
                                                    autoFocus
                                                />
                                                <Button size="sm" variant="ghost" onClick={() => handleRename(key.id)}>Save</Button>
                                                <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)}>Cancel</Button>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="font-medium">{key.name || 'Security Key'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Added {formatDate(key.createdAt)}
                                                    {key.lastUsedAt && ` • Last used ${formatDate(key.lastUsedAt)}`}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {renamingId !== key.id && (
                                    <div className="relative">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setShowDropdown(showDropdown === key.id ? null : key.id)}
                                            disabled={deletingId === key.id}
                                        >
                                            {deletingId === key.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <MoreVertical className="w-4 h-4" />
                                            )}
                                        </Button>

                                        {showDropdown === key.id && (
                                            <div className="absolute right-0 top-full mt-1 w-36 py-1 bg-popover border rounded-md shadow-lg z-10">
                                                <button
                                                    onClick={() => startRename(key)}
                                                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                                                >
                                                    <Pencil className="w-4 h-4" /> Rename
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(key.id)}
                                                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete
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
