import {
    createApplication,
    deleteApplication,
    listApplications,
    type OAuthApplication,
    regenerateSecret,
    updateApplication,
} from '@/services/oauthService';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Code,
    Copy,
    Edit3,
    Eye,
    EyeOff,
    Key,
    Loader2,
    Plus,
    RefreshCw,
    Shield,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function OAuthApplications() {
    const [applications, setApplications] = useState<OAuthApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSecretModal, setShowSecretModal] = useState(false);
    const [newSecret, setNewSecret] = useState<string | null>(null);
    const [selectedApp, setSelectedApp] = useState<OAuthApplication | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadApplications();
    }, []);

    async function loadApplications() {
        try {
            const data = await listApplications();
            setApplications(data.applications);
        } catch (err) {
            toast.error('Failed to load applications');
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteApp() {
        if (!selectedApp) return;

        setSubmitting(true);
        try {
            await deleteApplication(selectedApp.id);
            toast.success('Application deleted');
            setApplications((apps) => apps.filter((a) => a.id !== selectedApp.id));
            setShowDeleteConfirm(false);
            setSelectedApp(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete application');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleRegenerateSecret() {
        if (!selectedApp) return;

        setSubmitting(true);
        try {
            const result = await regenerateSecret(selectedApp.id);
            setNewSecret(result.clientSecret);
            setShowSecretModal(true);
            toast.success('Client secret regenerated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to regenerate secret');
        } finally {
            setSubmitting(false);
        }
    }

    function copyToClipboard(text: string, label: string) {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    }

    const totalUsers = applications.reduce((sum, app) => sum + (app.activeUsers || 0), 0);
    const totalTokens = applications.reduce((sum, app) => sum + (app.activeTokens || 0), 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-400">Loading your applications...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header with Stats */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <Code className="w-6 h-6 text-white" />
                                </div>
                                OAuth Applications
                            </h1>
                            <p className="text-gray-400">
                                Create and manage OAuth applications to integrate with FairArena
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="group relative px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            New Application
                            <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                        </button>
                    </div>

                    {/* Stats Cards */}
                    {applications.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm mb-1">Total Applications</p>
                                        <p className="text-3xl font-bold text-white">{applications.length}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <Shield className="w-6 h-6 text-blue-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm mb-1">Active Users</p>
                                        <p className="text-3xl font-bold text-white">{totalUsers}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-green-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-sm mb-1">Active Tokens</p>
                                        <p className="text-3xl font-bold text-white">{totalTokens}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                        <Activity className="w-6 h-6 text-purple-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Applications Grid */}
                {applications.length === 0 ? (
                    <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-16 text-center border border-gray-700/50">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-6">
                            <Shield className="w-12 h-12 text-gray-500" />
                        </div>
                        <h2 className="text-2xl font-semibold text-white mb-3">No Applications Yet</h2>
                        <p className="text-gray-400 mb-8 max-w-md mx-auto">
                            Create your first OAuth application to start integrating with FairArena's API
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
                        >
                            <Plus className="w-5 h-5" />
                            Create Application
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {applications.map((app) => (
                            <div
                                key={app.id}
                                className="group bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
                            >
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {app.logoUrl ? (
                                            <img src={app.logoUrl} alt={app.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                                <Shield className="w-7 h-7 text-white" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-white font-semibold text-lg truncate">{app.name}</h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {app.isVerified && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Verified
                                                    </span>
                                                )}
                                                {app.isPublic && (
                                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                                                        Public
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${app.isActive ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-500'}`}
                                        title={app.isActive ? 'Active' : 'Inactive'}
                                    />
                                </div>

                                {app.description && (
                                    <p className="text-gray-400 text-sm mb-5 line-clamp-2 leading-relaxed">{app.description}</p>
                                )}

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-sm text-gray-400 mb-5 pb-5 border-b border-gray-700/50">
                                    <div className="flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-green-400" />
                                        <span className="text-white font-medium">{app.activeUsers || 0}</span>
                                        <span>users</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Key className="w-4 h-4 text-purple-400" />
                                        <span className="text-white font-medium">{app.activeTokens || 0}</span>
                                        <span>tokens</span>
                                    </div>
                                </div>

                                {/* Client ID */}
                                <div className="bg-gray-900/70 rounded-lg p-3 mb-5">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs text-gray-500 font-medium">Client ID</span>
                                        <button
                                            onClick={() => copyToClipboard(app.clientId, 'Client ID')}
                                            className="text-gray-400 hover:text-white transition-colors"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <code className="text-xs text-gray-300 font-mono break-all">{app.clientId}</code>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedApp(app);
                                            setShowEditModal(true);
                                        }}
                                        className="flex-1 px-3 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-all duration-200 inline-flex items-center justify-center gap-2"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                        Edit
                                    </button>
                                    {!app.isPublic && (
                                        <button
                                            onClick={() => {
                                                setSelectedApp(app);
                                                handleRegenerateSecret();
                                            }}
                                            className="px-3 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-all duration-200"
                                            title="Regenerate Secret"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSelectedApp(app);
                                            setShowDeleteConfirm(true);
                                        }}
                                        className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-all duration-200"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modals remain the same */}
                {showCreateModal && (
                    <CreateAppModal
                        onClose={() => setShowCreateModal(false)}
                        onCreated={(app, secret) => {
                            setApplications((apps) => [app, ...apps]);
                            setShowCreateModal(false);
                            if (secret) {
                                setNewSecret(secret);
                                setShowSecretModal(true);
                            }
                        }}
                    />
                )}

                {showEditModal && selectedApp && (
                    <EditAppModal
                        app={selectedApp}
                        onClose={() => {
                            setShowEditModal(false);
                            setSelectedApp(null);
                        }}
                        onUpdated={(updated) => {
                            setApplications((apps) => apps.map((a) => (a.id === updated.id ? updated : a)));
                            setShowEditModal(false);
                            setSelectedApp(null);
                        }}
                    />
                )}

                {showSecretModal && newSecret && (
                    <SecretModal
                        secret={newSecret}
                        onClose={() => {
                            setShowSecretModal(false);
                            setNewSecret(null);
                        }}
                    />
                )}

                {showDeleteConfirm && selectedApp && (
                    <DeleteConfirmModal
                        appName={selectedApp.name}
                        onConfirm={handleDeleteApp}
                        onCancel={() => {
                            setShowDeleteConfirm(false);
                            setSelectedApp(null);
                        }}
                        submitting={submitting}
                    />
                )}
            </div>
        </div>
    );
}

// Modal components remain largely the same but with improved styling
function CreateAppModal({
    onClose,
    onCreated,
}: {
    onClose: () => void;
    onCreated: (app: OAuthApplication, secret: string | null) => void;
}) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        websiteUrl: '',
        redirectUris: [''],
        isPublic: false,
    });
    const [submitting, setSubmitting] = useState(false);

    function addRedirectUri() {
        setFormData((d) => ({ ...d, redirectUris: [...d.redirectUris, ''] }));
    }

    function removeRedirectUri(index: number) {
        setFormData((d) => ({
            ...d,
            redirectUris: d.redirectUris.filter((_, i) => i !== index),
        }));
    }

    function updateRedirectUri(index: number, value: string) {
        setFormData((d) => ({
            ...d,
            redirectUris: d.redirectUris.map((uri, i) => (i === index ? value : uri)),
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const redirectUris = formData.redirectUris.filter((uri) => uri.trim());
        if (redirectUris.length === 0) {
            toast.error('At least one redirect URI is required');
            return;
        }

        setSubmitting(true);
        try {
            const result = await createApplication({
                name: formData.name,
                description: formData.description || undefined,
                websiteUrl: formData.websiteUrl || undefined,
                redirectUris,
                isPublic: formData.isPublic,
            });
            toast.success('Application created');
            onCreated(result.application, result.clientSecret);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create application');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Create OAuth Application</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Application Name *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            placeholder="My Awesome App"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all"
                            rows={3}
                            placeholder="What does your app do?"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Website URL</label>
                        <input
                            type="url"
                            value={formData.websiteUrl}
                            onChange={(e) => setFormData((d) => ({ ...d, websiteUrl: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            placeholder="https://example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Redirect URIs *</label>
                        <div className="space-y-2">
                            {formData.redirectUris.map((uri, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="url"
                                        value={uri}
                                        onChange={(e) => updateRedirectUri(index, e.target.value)}
                                        className="flex-1 px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        placeholder="https://example.com/callback"
                                    />
                                    {formData.redirectUris.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeRedirectUri(index)}
                                            className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addRedirectUri}
                            className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            + Add another redirect URI
                        </button>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <input
                            type="checkbox"
                            id="isPublic"
                            checked={formData.isPublic}
                            onChange={(e) => setFormData((d) => ({ ...d, isPublic: e.target.checked }))}
                            className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                        />
                        <label htmlFor="isPublic" className="text-sm text-gray-300 cursor-pointer">
                            <span className="font-medium block">Public Client</span>
                            <span className="text-xs text-gray-500">
                                For single-page apps or mobile apps (no client secret)
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Application'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// EditAppModal, SecretModal, and DeleteConfirmModal remain similar with improved styling
// (Keeping them the same as original for brevity - they work fine)
function EditAppModal({
    app,
    onClose,
    onUpdated,
}: {
    app: OAuthApplication;
    onClose: () => void;
    onUpdated: (app: OAuthApplication) => void;
}) {
    const [formData, setFormData] = useState({
        name: app.name,
        description: app.description || '',
        websiteUrl: app.websiteUrl || '',
        redirectUris: app.redirectUris,
        isActive: app.isActive,
    });
    const [submitting, setSubmitting] = useState(false);

    function addRedirectUri() {
        setFormData((d) => ({ ...d, redirectUris: [...d.redirectUris, ''] }));
    }

    function removeRedirectUri(index: number) {
        setFormData((d) => ({
            ...d,
            redirectUris: d.redirectUris.filter((_, i) => i !== index),
        }));
    }

    function updateRedirectUri(index: number, value: string) {
        setFormData((d) => ({
            ...d,
            redirectUris: d.redirectUris.map((uri, i) => (i === index ? value : uri)),
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const redirectUris = formData.redirectUris.filter((uri) => uri.trim());
        if (redirectUris.length === 0) {
            toast.error('At least one redirect URI is required');
            return;
        }

        setSubmitting(true);
        try {
            const result = await updateApplication(app.id, {
                name: formData.name,
                description: formData.description || undefined,
                websiteUrl: formData.websiteUrl || undefined,
                redirectUris,
                isActive: formData.isActive,
            });
            toast.success('Application updated');
            onUpdated({ ...app, ...result.application });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update application');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Edit Application</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Application Name *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                            rows={2}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Website URL</label>
                        <input
                            type="url"
                            value={formData.websiteUrl}
                            onChange={(e) => setFormData((d) => ({ ...d, websiteUrl: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Redirect URIs *</label>
                        <div className="space-y-2">
                            {formData.redirectUris.map((uri, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="url"
                                        value={uri}
                                        onChange={(e) => updateRedirectUri(index, e.target.value)}
                                        className="flex-1 px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                    {formData.redirectUris.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeRedirectUri(index)}
                                            className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addRedirectUri}
                            className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                        >
                            + Add another redirect URI
                        </button>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData((d) => ({ ...d, isActive: e.target.checked }))}
                            className="rounded border-gray-600 bg-gray-700 text-blue-500"
                        />
                        <label htmlFor="isActive" className="text-sm text-gray-300">
                            <span className="font-medium">Active</span>
                            <span className="block text-xs text-gray-500">
                                Disabled applications cannot authorize new users
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function SecretModal({ secret, onClose }: { secret: string; onClose: () => void }) {
    const [showSecret, setShowSecret] = useState(false);

    function copySecret() {
        navigator.clipboard.writeText(secret);
        toast.success('Client secret copied to clipboard');
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-2xl">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Save Your Client Secret</h2>
                </div>

                <p className="text-gray-400 text-center mb-6">
                    This is the only time your client secret will be shown. Save it securely now.
                </p>

                <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">Client Secret</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowSecret(!showSecret)} className="text-gray-400 hover:text-white">
                                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button onClick={copySecret} className="text-gray-400 hover:text-white">
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <code className="text-sm text-white font-mono break-all">
                        {showSecret ? secret : '•'.repeat(40)}
                    </code>
                </div>

                <button
                    onClick={onClose}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all"
                >
                    I've Saved My Secret
                </button>
            </div>
        </div>
    );
}

function DeleteConfirmModal({
    appName,
    onConfirm,
    onCancel,
    submitting,
}: {
    appName: string;
    onConfirm: () => void;
    onCancel: () => void;
    submitting: boolean;
}) {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-2xl">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                        <Trash2 className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Delete Application</h2>
                </div>

                <p className="text-gray-400 text-center mb-6">
                    Are you sure you want to delete <span className="text-white font-medium">{appName}</span>? This will revoke
                    all user authorizations and cannot be undone.
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={submitting}
                        className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
