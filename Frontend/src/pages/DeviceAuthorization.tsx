import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { CheckCircle2, Loader2, Shield, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface DeviceRequest {
    application: {
        name: string;
        description?: string;
        logoUrl?: string;
        websiteUrl?: string;
        privacyPolicyUrl?: string;
        termsOfServiceUrl?: string;
        isVerified: boolean;
    };
    scopes: Array<{
        name: string;
        displayName: string;
        description: string;
        isDangerous: boolean;
    }>;
    user_code: string;
}

export default function DeviceAuthorization() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [userCode, setUserCode] = useState(searchParams.get('user_code') || '');
    const [deviceRequest, setDeviceRequest] = useState<DeviceRequest | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [denied, setDenied] = useState(false);

    const handleVerify = async () => {
        if (!userCode.trim()) {
            setError('Please enter a code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await apiClient.get(`/api/v1/oauth/device/verify?user_code=${userCode.trim()}`);
            setDeviceRequest(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error_description || 'Invalid or expired code');
        } finally {
            setLoading(false);
        }
    };

    const handleConsent = async (action: 'approve' | 'deny') => {
        setLoading(true);
        setError('');

        try {
            await apiClient.post(`${import.meta.env.VITE_API_BASE_URL}/api/v1/oauth/device/consent`, {
                user_code: userCode.trim(),
                action,
            });

            if (action === 'approve') {
                setSuccess(true);
            } else {
                setDenied(true);
            }
        } catch (err: any) {
            setError(err.response?.data?.error_description || 'Failed to process request');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle>Device Authorized!</CardTitle>
                        <CardDescription>
                            You can now return to your device and continue using the application.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate('/')} className="w-full">
                            Return to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (denied) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                            <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                        </div>
                        <CardTitle>Authorization Denied</CardTitle>
                        <CardDescription>
                            You have denied access to this device. The application will not be able to access your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate('/')} className="w-full">
                            Return to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!deviceRequest) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Shield className="h-10 w-10 text-primary" />
                        </div>
                        <CardTitle className="text-center">Device Authorization</CardTitle>
                        <CardDescription className="text-center">
                            Enter the code displayed on your device to authorize access
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="userCode">Device Code</Label>
                            <Input
                                id="userCode"
                                placeholder="ABCD-1234"
                                value={userCode}
                                onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                                maxLength={9}
                                className="text-center text-lg font-mono tracking-wider"
                                disabled={loading}
                            />
                            <p className="text-xs text-muted-foreground text-center">
                                Enter the code exactly as shown on your device
                            </p>
                        </div>

                        <Button onClick={handleVerify} disabled={loading || !userCode.trim()} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Continue
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    {deviceRequest.application?.logoUrl && (
                        <div className="mx-auto mb-4">
                            <img
                                src={deviceRequest.application.logoUrl}
                                alt={deviceRequest.application.name}
                                className="h-16 w-16 rounded-lg object-cover"
                            />
                        </div>
                    )}
                    <CardTitle className="text-center">{deviceRequest.application?.name || 'Unknown Application'}</CardTitle>
                    <CardDescription className="text-center">
                        {deviceRequest.application?.description || 'wants to access your FairArena account'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="rounded-lg border p-4">
                        <h3 className="mb-2 font-semibold">This application will be able to:</h3>
                        <ul className="space-y-2">
                            {(deviceRequest.scopes || []).map((scope) => (
                                <li key={scope.name} className="flex items-start gap-2 text-sm">
                                    <Shield className={`mt-0.5 h-4 w-4 flex-shrink-0 ${scope.isDangerous ? 'text-destructive' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className="font-medium">{scope.displayName}</p>
                                        <p className="text-muted-foreground">{scope.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {deviceRequest.application?.privacyPolicyUrl && (
                        <p className="text-xs text-center text-muted-foreground">
                            <a
                                href={deviceRequest.application.privacyPolicyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-foreground"
                            >
                                Privacy Policy
                            </a>
                        </p>
                    )}

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => handleConsent('deny')}
                            disabled={loading}
                            className="flex-1"
                        >
                            Deny
                        </Button>
                        <Button
                            onClick={() => handleConsent('approve')}
                            disabled={loading}
                            className="flex-1"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Authorize
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
