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
    Search,
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
    const [searchQuery, setSearchQuery] = useState('');

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

    const filteredApps = applications.filter(app =>
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.clientId.includes(searchQuery)
    );

    const totalUsers = applications.reduce((sum, app) => sum + (app.activeUsers || 0), 0);
    const totalTokens = applications.reduce((sum, app) => sum + (app.activeTokens || 0), 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-900 dark:text-neutral-100 mx-auto mb-4" />
                    <p className="text-sm font-medium text-neutral-500">Loading your applications...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6 sm:p-10 transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header with Stats */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-200 dark:border-neutral-800 pb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
                            OAuth Applications
                        </h1>
                        <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl">
                            Create and manage OAuth applications to integrate securely with the FairArena platform.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="group flex items-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg font-semibold hover:opacity-90 transition-all shadow-sm active:scale-[0.98]"
                    >
                        <Plus className="w-5 h-5" />
                        New Application
                    </button>
                </div>

                {/* Stats Cards */}
                {applications.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-black p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-medium text-neutral-500">Total Applications</p>
                                <Shield className="w-5 h-5 text-neutral-400" />
                            </div>
                            <p className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">{applications.length}</p>
                        </div>
                        <div className="bg-white dark:bg-black p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-medium text-neutral-500">Active Users</p>
                                <Users className="w-5 h-5 text-neutral-400" />
                            </div>
                            <p className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">{totalUsers}</p>
                        </div>
                        <div className="bg-white dark:bg-black p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-medium text-neutral-500">Active Tokens</p>
                                <Activity className="w-5 h-5 text-neutral-400" />
                            </div>
                            <p className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">{totalTokens}</p>
                        </div>
                    </div>
                )}

                {/* Search / Filters (if needed, adding simple search) */}
                {applications.length > 0 && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search applications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-80 px-10 py-2.5 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-all placeholder:text-neutral-400"
                        />
                    </div>
                )}

                {/* Applications Grid */}
                {applications.length === 0 ? (
                    <div className="bg-white dark:bg-black rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-6">
                            <Code className="w-8 h-8 text-neutral-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">No Applications Yet</h2>
                        <p className="text-neutral-500 dark:text-neutral-400 mb-8 max-w-md mx-auto">
                            Start building by creating your first OAuth application.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-90 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Create Application
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredApps.map((app) => (
                            <div
                                key={app.id}
                                className="group bg-white dark:bg-black rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md transition-all duration-200 flex flex-col"
                            >
                                <div className="p-6 flex-1">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            {app.logoUrl ? (
                                                <img src={app.logoUrl} alt={app.name} className="w-12 h-12 rounded-lg object-cover border border-neutral-100 dark:border-neutral-800" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-500 font-bold text-lg">
                                                    {app.name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-1">{app.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`inline-block w-2 h-2 rounded-full ${app.isActive ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`} />
                                                    <span className="text-xs text-neutral-500">{app.isActive ? 'Active' : 'Inactive'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {app.description ? (
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 line-clamp-2 h-10">
                                            {app.description}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-neutral-400 italic mb-6 h-10 flex items-center">No description provided.</p>
                                    )}

                                    {/* Client ID */}
                                    <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 border border-neutral-100 dark:border-neutral-800 mb-6 group-hover:bg-neutral-100 dark:group-hover:bg-neutral-900 transition-colors">
                                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-1 block">Client ID</span>
                                        <div className="flex items-center justify-between gap-2">
                                            <code className="text-xs font-mono text-neutral-700 dark:text-neutral-300 truncate">{app.clientId}</code>
                                            <button
                                                onClick={() => copyToClipboard(app.clientId, 'Client ID')}
                                                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" />
                                            <span><strong className="text-neutral-900 dark:text-white font-medium">{app.activeUsers || 0}</strong> users</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="px-6 py-4 bg-neutral-50/50 dark:bg-neutral-900/30 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedApp(app);
                                            setShowEditModal(true);
                                        }}
                                        className="flex-1 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        Edit
                                    </button>

                                    {!app.isPublic && (
                                        <button
                                            onClick={() => {
                                                setSelectedApp(app);
                                                handleRegenerateSecret();
                                            }}
                                            className="p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-lg transition-all"
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
                                        className="p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-red-50 dark:hover:bg-red-900/10 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/30 rounded-lg transition-all"
                                        title="Delete Application"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modals */}
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

// --- Modals ---

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
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-black rounded-2xl p-6 md:p-8 max-w-lg w-full border border-neutral-200 dark:border-neutral-800 shadow-xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">New Application</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">Application Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-all"
                                placeholder="My Awesome App"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white resize-none transition-all"
                                rows={3}
                                placeholder="What does your app do?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">Website URL</label>
                            <input
                                type="url"
                                value={formData.websiteUrl}
                                onChange={(e) => setFormData((d) => ({ ...d, websiteUrl: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-all"
                                placeholder="https://example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">Redirect URIs</label>
                            <div className="space-y-2">
                                {formData.redirectUris.map((uri, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="url"
                                            value={uri}
                                            onChange={(e) => updateRedirectUri(index, e.target.value)}
                                            className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-all"
                                            placeholder="https://example.com/callback"
                                        />
                                        {formData.redirectUris.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRedirectUri(index)}
                                                className="px-3 py-2 bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
                                className="mt-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" />
                                Add another URI
                            </button>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    id="isPublic"
                                    checked={formData.isPublic}
                                    onChange={(e) => setFormData((d) => ({ ...d, isPublic: e.target.checked }))}
                                    className="peer sr-only"
                                />
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer
                                    ${formData.isPublic
                                        ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white'
                                        : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-black'
                                    }
                                `}>
                                    {formData.isPublic && <CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-black" />}
                                </div>
                                <label htmlFor="isPublic" className="absolute inset-0 cursor-pointer"></label>
                            </div>

                            <label htmlFor="isPublic" className="text-sm cursor-pointer select-none">
                                <span className="font-semibold text-neutral-900 dark:text-white block">Public Client</span>
                                <span className="text-xs text-neutral-500 block">
                                    For mobile or single-page apps (SPA) without a backend.
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white rounded-xl font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-3 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Application'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

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
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-black rounded-2xl p-6 md:p-8 max-w-lg w-full border border-neutral-200 dark:border-neutral-800 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Edit Application</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Simplified Form Inputs just like Create but with values */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white resize-none transition-all"
                                rows={2}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">Website</label>
                            <input
                                type="url"
                                value={formData.websiteUrl}
                                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">Redirect URIs</label>
                            <div className="space-y-2">
                                {formData.redirectUris.map((uri, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="url"
                                            value={uri}
                                            onChange={(e) => {
                                                const newUris = [...formData.redirectUris];
                                                newUris[index] = e.target.value;
                                                setFormData({ ...formData, redirectUris: newUris });
                                            }}
                                            className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, redirectUris: formData.redirectUris.filter((_, i) => i !== index) })}
                                            className="px-3 py-2 bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, redirectUris: [...formData.redirectUris, ''] })}
                                className="mt-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors border-none bg-transparent"
                            >
                                + Add another URI
                            </button>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="peer sr-only"
                                />
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer
                                    ${formData.isActive
                                        ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white'
                                        : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-black'
                                    }
                                `}>
                                    {formData.isActive && <CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-black" />}
                                </div>
                                <label htmlFor="isActive" className="absolute inset-0 cursor-pointer"></label>
                            </div>

                            <label htmlFor="isActive" className="text-sm cursor-pointer select-none">
                                <span className="font-semibold text-neutral-900 dark:text-white block">Active Status</span>
                                <span className="text-xs text-neutral-500 block">
                                    Disabling prevents new authorizations.
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white rounded-xl font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-3 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
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
        toast.success('Client secret copied');
    }

    return (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-black rounded-2xl p-8 max-w-md w-full border border-neutral-200 dark:border-neutral-800 shadow-xl">
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <Key className="w-6 h-6 text-neutral-900 dark:text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Save Your Client Secret</h2>
                    <p className="text-sm text-neutral-500 mt-2">
                        This is the only time your valid client secret will be shown. Save it securely.
                    </p>
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-4 mb-8 border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Client Secret</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setShowSecret(!showSecret)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
                                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button onClick={copySecret} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <code className="text-sm text-neutral-900 dark:text-white font-mono break-all block">
                        {showSecret ? secret : '•'.repeat(40)}
                    </code>
                </div>

                <button
                    onClick={onClose}
                    className="w-full px-4 py-3 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl font-semibold hover:opacity-90 transition-all"
                >
                    I've Saved It
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
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-black rounded-2xl p-6 max-w-sm w-full border border-neutral-200 dark:border-neutral-800 shadow-xl">
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                    </div>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Delete Application?</h2>
                    <p className="text-sm text-neutral-500 mt-2">
                        Are you sure you want to delete <strong className="text-neutral-900 dark:text-white">{appName}</strong>? This action cannot be undone.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 text-neutral-900 dark:text-white rounded-xl font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={submitting}
                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
