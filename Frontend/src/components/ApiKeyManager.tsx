import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Copy, Key, Loader2, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/apiClient';

interface ApiKey {
    id: string;
    name: string;
    keyPrefix: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
}

interface NewApiKey {
    id: string;
    name: string;
    key: string;
    expiresAt: string | null;
}

export const ApiKeyManager: React.FC = () => {
    const { isDark } = useTheme();
    const [creating, setCreating] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    // New key creation state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyExpires, setNewKeyExpires] = useState<string>('90'); // days
    const [createdKey, setCreatedKey] = useState<NewApiKey | null>(null);
    const [copied, setCopied] = useState(false);

    // Delete confirmation modal state
    const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);

    const queryClient = useQueryClient();

    // Fetch keys with useQuery
    const { data: apiKeys = [], isLoading: loading } = useQuery({
        queryKey: ['apiKeys'],
        queryFn: () => apiRequest<{ success: boolean; data: { keys: ApiKey[] } }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/api-keys`)
            .then(res => res.data.keys),
        staleTime: 60000,
    });

    const createKeyMutation = useMutation({
        mutationFn: (data: { name: string; expiresIn: number | null }) =>
            apiRequest<{ success: boolean; data: NewApiKey; message?: string }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/api-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }),
        onSuccess: (data) => {
            if (data.success) {
                setCreatedKey(data.data);
                setShowCreateModal(false);
                setNewKeyName('');
                queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
                toast.success('API key created successfully');
            } else {
                toast.error(data.message || 'Failed to create API key');
            }
        },
        onError: () => {
            toast.error('An error occurred while creating the API key');
        },
    });

    const handleCreateKey = () => {
        if (!newKeyName.trim()) {
            toast.error('Please enter a name for your API key');
            return;
        }

        setCreating(true);
        createKeyMutation.mutate({
            name: newKeyName,
            expiresIn: newKeyExpires === 'never' ? null : parseInt(newKeyExpires)
        }, {
            onSettled: () => setCreating(false)
        });
    };

    const revokeKeyMutation = useMutation({
        mutationFn: (id: string) =>
            apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/api-keys/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            toast.success('API key revoked successfully');
            queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
        },
        onError: () => {
            toast.error('An error occurred while revoking the API key');
        },
    });

    const confirmRevokeKey = async () => {
        if (!keyToDelete) return;

        setRevokingId(keyToDelete.id);
        revokeKeyMutation.mutate(keyToDelete.id, {
            onSettled: () => {
                setRevokingId(null);
                setKeyToDelete(null);
            }
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Copied to clipboard');
    };

    return (
        <div className={`rounded-xl border ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'} shadow-lg p-6`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                        <Key className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
                        <p className="text-sm text-muted-foreground">Manage API keys for programmatic access to your account.</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isDark
                        ? 'bg-[#DDEF00] text-black hover:bg-[#DDEF00]/90'
                        : 'bg-black text-white hover:bg-black/90'
                        }`}
                >
                    <Plus className="w-4 h-4" />
                    Create New Key
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : apiKeys.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                    You haven't created any API keys yet.
                </div>
            ) : (
                <div className="space-y-4">
                    {apiKeys.map(key => (
                        <div
                            key={key.id}
                            className={`p-4 rounded-lg border ${isDark ? 'bg-muted/30 border-border' : 'bg-gray-50 border-gray-200'}`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-medium text-foreground">{key.name}</h4>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground font-mono">
                                        <span className="flex items-center gap-1">
                                            prefix: <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{key.keyPrefix}</span>
                                        </span>
                                        <span>•</span>
                                        <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                                        {key.lastUsedAt && (
                                            <>
                                                <span>•</span>
                                                <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setKeyToDelete(key)}
                                        disabled={revokingId === key.id}
                                        className={`p-2 rounded-lg transition-colors ${isDark
                                            ? 'hover:bg-red-500/20 text-red-400'
                                            : 'hover:bg-red-100 text-red-600'
                                            }`}
                                        title="Revoke key"
                                    >
                                        {revokingId === key.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Key Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`relative w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-card border border-border' : 'bg-white'}`}>
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="absolute top-4 right-4 p-1 hover:bg-muted rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>

                        <h3 className="text-xl font-bold mb-4">Create New API Key</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Key Name</label>
                                <input
                                    type="text"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="e.g. Production Server, Test App"
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-primary/20 ${isDark ? 'bg-background border-input' : 'border-gray-300'
                                        }`}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Expiration</label>
                                <select
                                    value={newKeyExpires}
                                    onChange={(e) => setNewKeyExpires(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-primary/20 ${isDark ? 'bg-background border-input' : 'border-gray-300'
                                        }`}
                                >
                                    <option value="30">30 days</option>
                                    <option value="90">90 days</option>
                                    <option value="365">1 year</option>
                                    <option value="never">Never expire</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateKey}
                                    disabled={creating || !newKeyName.trim()}
                                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${isDark
                                        ? 'bg-[#DDEF00] text-black hover:bg-[#DDEF00]/90'
                                        : 'bg-black text-white hover:bg-black/90'
                                        } disabled:opacity-50`}
                                >
                                    {creating ? 'Creating...' : 'Create Key'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Created Key Success Modal */}
            {createdKey && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`relative w-full max-w-lg rounded-xl p-6 ${isDark ? 'bg-card border border-border' : 'bg-white'}`}>
                        <div className="flex items-center gap-3 mb-4 text-green-500">
                            <div className="p-2 bg-green-500/10 rounded-full">
                                <Check className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">API Key Created</h3>
                        </div>

                        <p className="text-muted-foreground mb-4">
                            Please copy your new API key now. <strong className="text-red-500">You won't be able to see it again!</strong>
                        </p>

                        <div className={`p-4 rounded-lg font-mono text-sm break-all mb-4 relative group ${isDark ? 'bg-muted' : 'bg-gray-100'
                            }`}>
                            {createdKey.key}
                            <button
                                onClick={() => copyToClipboard(createdKey.key)}
                                className="absolute top-2 right-2 p-2 rounded-md hover:bg-background/50 transition-colors"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 p-3 rounded-lg text-sm mb-6 flex gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>Store this key securely. If you lose it, you'll need to generate a new one.</p>
                        </div>

                        <button
                            onClick={() => setCreatedKey(null)}
                            className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                        >
                            I've saved my key
                        </button>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {keyToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`relative w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-card border border-border' : 'bg-white'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-3 rounded-full ${isDark ? 'bg-red-500/10' : 'bg-red-100'}`}>
                                <AlertTriangle className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">Revoke API Key</h3>
                        </div>

                        <p className="text-muted-foreground mb-2">
                            Are you sure you want to revoke <strong className="text-foreground">{keyToDelete.name}</strong>?
                        </p>
                        <p className="text-sm text-muted-foreground mb-6">
                            Any applications using this key will immediately lose access. This action cannot be undone.
                        </p>

                        <div className={`p-3 rounded-lg mb-6 ${isDark ? 'bg-muted' : 'bg-gray-100'}`}>
                            <div className="text-xs text-muted-foreground">Key Prefix</div>
                            <div className="font-mono text-sm">{keyToDelete.keyPrefix}</div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setKeyToDelete(null)}
                                disabled={revokingId !== null}
                                className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted transition-colors font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRevokeKey}
                                disabled={revokingId !== null}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isDark
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                                    } disabled:opacity-50`}
                            >
                                {revokingId ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Revoking...
                                    </>
                                ) : (
                                    'Revoke Key'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
