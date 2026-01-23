import { AlertCircle, Check, Copy, RefreshCw, TestTube2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '../../lib/apiClient';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface SSOConfig {
    id: string;
    domain: string;
    providerType: string;
    issuerUrl: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl?: string;
    clientId: string;
    clientSecret?: string;
    scimEnabled: boolean;
    scimToken?: string;
    isActive: boolean;
}

interface Props {
    organizationId: string;
}

export const SSOConfigSettings: React.FC<Props> = ({ organizationId }) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    // Internal helper to match axios interface used in this component
    const apiClient = {
        get: (url: string) => apiRequest<any>(`${baseUrl}/api/v1${url}`).then(data => ({ data })),
        post: (url: string, body: any) => apiRequest<any>(`${baseUrl}/api/v1${url}`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        }).then(data => ({ data }))
    };
    const [config, setConfig] = useState<SSOConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [scimEndpointCopied, setScimEndpointCopied] = useState(false);

    // Verification State
    const [verificationStatus, setVerificationStatus] = useState<{
        verified: boolean;
        verifiedAt?: string;
        hasToken: boolean;
        attemptsUsed: number;
    } | null>(null);

    const [verificationToken, setVerificationToken] = useState<{
        recordName: string;
        recordValue: string;
        instructions: string[];
    } | null>(null);

    const [verifying, setVerifying] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        domain: '',
        providerType: 'oidc',
        issuerUrl: '',
        authorizationUrl: '',
        tokenUrl: '',
        userInfoUrl: '',
        clientId: '',
        clientSecret: '',
        scimEnabled: false,
        isActive: false,
    });

    const scimEndpoint = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/v1/scim/v2`;

    // Load existing config
    useEffect(() => {
        loadConfig();
        loadVerificationStatus();
    }, [organizationId]);

    const loadConfig = async () => {
        try {
            const res = await apiClient.get(`/organization/${organizationId}/sso-config`);
            if (res.data.success && res.data.data) {
                setConfig(res.data.data);
                setFormData({
                    domain: res.data.data.domain || '',
                    providerType: res.data.data.providerType || 'oidc',
                    issuerUrl: res.data.data.issuerUrl || '',
                    authorizationUrl: res.data.data.authorizationUrl || '',
                    tokenUrl: res.data.data.tokenUrl || '',
                    userInfoUrl: res.data.data.userInfoUrl || '',
                    clientId: res.data.data.clientId || '',
                    clientSecret: '', // Don't populate, masked on backend
                    scimEnabled: res.data.data.scimEnabled || false,
                    isActive: res.data.data.isActive || false,
                });
            }
        } catch (error) {
            toast.error('Failed to load SSO configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await apiClient.post(`/organization/${organizationId}/sso-config`, formData);
            if (res.data.success) {
                toast.success('SSO configuration saved successfully');
                loadConfig();
            }
        } catch (error: any) {
            toast.error(error.data?.message || 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const res = await apiClient.post(`/organization/${organizationId}/sso-config/test`, {});
            if (res.data.success) {
                toast.success('SSO connection test successful!');
            }
        } catch (error: any) {
            toast.error(error.data?.message || 'Connection test failed');
        } finally {
            setTesting(false);
        }
    };

    const handleRegenerateSCIMToken = async () => {
        if (!window.confirm('Are you sure? This will invalidate the current SCIM token.')) return;

        try {
            const res = await apiClient.post(`/organization/${organizationId}/sso-config/scim-token`, {});
            if (res.data.success) {
                toast.success('SCIM token regenerated');
                // Show the new token in an alert
                alert(`New SCIM Token (save this, it won't be shown again):\n\n${res.data.token}`);
                loadConfig();
            }
        } catch (error) {
            toast.error('Failed to regenerate SCIM token');
        }
    };

    const loadVerificationStatus = async () => {
        try {
            const res = await apiClient.get(`/organization/${organizationId}/sso-config/verification-status`);
            if (res.data.success) {
                setVerificationStatus(res.data.data);
            }
        } catch (error) {
            console.error('Failed to load verification status', error);
        }
    };

    const handleInitiateVerification = async () => {
        try {
            const res = await apiClient.post(`/organization/${organizationId}/sso-config/verify-domain/initiate`, {});
            if (res.data.success) {
                setVerificationToken(res.data.data);
                toast.success('Verification token generated! Add the DNS record to continue.');
            }
        } catch (error: any) {
            toast.error(error.data?.message || 'Failed to generate verification token');
        }
    };

    const handleVerifyDomain = async () => {
        setVerifying(true);
        try {
            const res = await apiClient.post(`/organization/${organizationId}/sso-config/verify-domain/check`, {});
            if (res.data.success) {
                toast.success('Domain verified successfully!');
                loadVerificationStatus();
                setVerificationToken(null);
            }
        } catch (error: any) {
            toast.error(error.data?.message || 'Verification failed');
            loadVerificationStatus(); // Update attempts info
        } finally {
            setVerifying(false);
        }
    };

    const copyToClipboard = async (text: string, type: 'token' | 'endpoint') => {
        await navigator.clipboard.writeText(text);
        if (type === 'token') {
            setTokenCopied(true);
            setTimeout(() => setTokenCopied(false), 2000);
        } else {
            setScimEndpointCopied(true);
            setTimeout(() => setScimEndpointCopied(false), 2000);
        }
        toast.success('Copied to clipboard');
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DDEF00]"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Enterprise Single Sign-On (SSO)</CardTitle>
                    <CardDescription>
                        Configure OIDC-based SSO for your organization. Users with matching email domains will be automatically redirected to your identity provider.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="oidc" className="w-full">
                        <TabsList>
                            <TabsTrigger value="oidc">OIDC Configuration</TabsTrigger>
                            <TabsTrigger value="scim">SCIM Provisioning</TabsTrigger>
                        </TabsList>

                        <TabsContent value="oidc" className="space-y-4 mt-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="domain">Email Domain</Label>
                                    <Input
                                        id="domain"
                                        value={formData.domain}
                                        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                        placeholder="company.com"
                                        required
                                    />
                                    <p className="text-xs text-neutral-500">Users with this email domain will use SSO</p>
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <Label>Domain Verification Status</Label>

                                    {verificationStatus?.verified ? (
                                        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg animate-in fade-in zoom-in duration-300">
                                            <Check className="w-5 h-5 text-green-500" />
                                            <div>
                                                <p className="text-sm font-medium text-green-500">Domain Verified</p>
                                                <p className="text-xs text-neutral-500">
                                                    Verified on {new Date(verificationStatus.verifiedAt!).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                                <div>
                                                    <p className="text-sm font-medium text-amber-500">Domain Not Verified</p>
                                                    <p className="text-xs text-neutral-500">
                                                        Verify domain ownership to activate SSO
                                                    </p>
                                                </div>
                                            </div>

                                            {!verificationToken ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleInitiateVerification}
                                                    className="w-full"
                                                >
                                                    Generate Verification Code
                                                </Button>
                                            ) : (
                                                <div className="space-y-3 p-4 bg-muted/50 rounded-lg animate-in slide-in-from-top-2 duration-300">
                                                    <p className="text-sm font-medium">Add this DNS TXT Record:</p>

                                                    <div className="space-y-2">
                                                        <div>
                                                            <Label className="text-xs">Record Name</Label>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    value={verificationToken.recordName}
                                                                    readOnly
                                                                    className="font-mono text-sm"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(verificationToken.recordName);
                                                                        toast.success('Copied!');
                                                                    }}
                                                                >
                                                                    <Copy className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <Label className="text-xs">Record Value</Label>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    value={verificationToken.recordValue}
                                                                    readOnly
                                                                    className="font-mono text-sm"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(verificationToken.recordValue);
                                                                        toast.success('Copied!');
                                                                    }}
                                                                >
                                                                    <Copy className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-neutral-500 space-y-1">
                                                        {verificationToken.instructions.map((instruction, i) => (
                                                            <p key={i}>{instruction}</p>
                                                        ))}
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        onClick={handleVerifyDomain}
                                                        disabled={verifying}
                                                        className="w-full bg-[#DDEF00] text-black hover:bg-[#cbe600]"
                                                    >
                                                        {verifying ? 'Verifying...' : 'Verify Domain'}
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <Label htmlFor="issuerUrl">Issuer URL</Label>
                                    <Input
                                        id="issuerUrl"
                                        value={formData.issuerUrl}
                                        onChange={(e) => setFormData({ ...formData, issuerUrl: e.target.value })}
                                        placeholder="https://accounts.google.com"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="authorizationUrl">Authorization URL</Label>
                                        <Input
                                            id="authorizationUrl"
                                            value={formData.authorizationUrl}
                                            onChange={(e) => setFormData({ ...formData, authorizationUrl: e.target.value })}
                                            placeholder="https://accounts.google.com/o/oauth2/v2/auth"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="tokenUrl">Token URL</Label>
                                        <Input
                                            id="tokenUrl"
                                            value={formData.tokenUrl}
                                            onChange={(e) => setFormData({ ...formData, tokenUrl: e.target.value })}
                                            placeholder="https://oauth2.googleapis.com/token"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="userInfoUrl">UserInfo URL (Optional)</Label>
                                    <Input
                                        id="userInfoUrl"
                                        value={formData.userInfoUrl}
                                        onChange={(e) => setFormData({ ...formData, userInfoUrl: e.target.value })}
                                        placeholder="https://openidconnect.googleapis.com/v1/userinfo"
                                    />
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="clientId">Client ID</Label>
                                        <Input
                                            id="clientId"
                                            value={formData.clientId}
                                            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                                            placeholder="your-client-id"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="clientSecret">Client Secret</Label>
                                        <Input
                                            id="clientSecret"
                                            type="password"
                                            value={formData.clientSecret}
                                            onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                                            placeholder={config ? '********' : 'your-client-secret'}
                                        />
                                        {config && <p className="text-xs text-neutral-500">Leave blank to keep current secret</p>}
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Enable SSO</Label>
                                        <p className="text-xs text-neutral-500">
                                            Activate SSO for this domain
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.isActive}
                                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <Button type="submit" disabled={saving} className="bg-[#DDEF00] text-black hover:bg-[#cbe600]">
                                        {saving ? 'Saving...' : 'Save Configuration'}
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleTestConnection}
                                        disabled={testing || !config}
                                    >
                                        {testing ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                Testing...
                                            </>
                                        ) : (
                                            <>
                                                <TestTube2 className="w-4 h-4 mr-2" />
                                                Test Connection
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>

                        <TabsContent value="scim" className="space-y-4 mt-4">
                            {!config ? (
                                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">Configure SSO First</p>
                                        <p className="text-xs text-neutral-500">
                                            You need to save your OIDC configuration before enabling SCIM provisioning.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>SCIM Base URL</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={scimEndpoint}
                                                    readOnly
                                                    className="font-mono text-sm"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => copyToClipboard(scimEndpoint, 'endpoint')}
                                                >
                                                    {scimEndpointCopied ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label>Bearer Token</Label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleRegenerateSCIMToken}
                                                    disabled={!formData.scimEnabled}
                                                >
                                                    <RefreshCw className="w-3 h-3 mr-1" />
                                                    Regenerate
                                                </Button>
                                            </div>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={config.scimToken || 'Enable SCIM to generate a token'}
                                                    readOnly
                                                    className="font-mono text-sm"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => copyToClipboard(config.scimToken || '', 'token')}
                                                    disabled={!config.scimToken}
                                                >
                                                    {tokenCopied ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-neutral-500">
                                                Use this bearer token to authenticate SCIM requests from your IdP
                                            </p>
                                        </div>

                                        <Separator />

                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>Enable SCIM Provisioning</Label>
                                                <p className="text-xs text-neutral-500">
                                                    Allow your IdP to automatically provision/deprovision users
                                                </p>
                                            </div>
                                            <Switch
                                                checked={formData.scimEnabled}
                                                onCheckedChange={(checked) => {
                                                    setFormData({ ...formData, scimEnabled: checked });
                                                    // Auto-save this setting
                                                    apiClient.post(`/organization/${organizationId}/sso-config`, {
                                                        ...formData,
                                                        scimEnabled: checked,
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                        <p className="text-sm font-medium mb-2">Setup Instructions</p>
                                        <ol className="text-xs text-neutral-400 space-y-1 list-decimal list-inside">
                                            <li>Copy the SCIM Base URL above</li>
                                            <li>Generate and copy the Bearer Token</li>
                                            <li>Configure SCIM in your Identity Provider (Azure AD, Okta, etc.)</li>
                                            <li>Use the URL and token to authenticate SCIM requests</li>
                                            <li>Enable automatic user provisioning in your IdP</li>
                                        </ol>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
};
