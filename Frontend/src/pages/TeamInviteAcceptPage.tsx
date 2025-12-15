import { useAuth, useUser } from '@clerk/clerk-react';
import { CheckCircle2, Loader2, Shield, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '../components/ui/card';

interface InvitationDetails {
    id: string;
    email: string;
    organizationName: string;
    organizationSlug: string;
    teamName: string;
    teamSlug: string;
    roleName: string;
    expiresAt: string;
    createdAt: string;
}

const TeamInviteAcceptPage = () => {
    const { inviteCode } = useParams<{ inviteCode: string }>();
    const navigate = useNavigate();
    const { getToken, isSignedIn } = useAuth();
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const fetchInvitationDetails = async () => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/invite/${inviteCode}`
            );

            if (response.ok) {
                const data = await response.json();
                setInvitation(data.invitation);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Invalid or expired invitation');
            }
        } catch {
            setError('Failed to load invitation details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (inviteCode) {
            fetchInvitationDetails();
        }
    }, [inviteCode]);

    const handleAcceptInvitation = async () => {
        if (!isSignedIn) {
            // Redirect to sign in with return URL
            window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`;
            return;
        }

        // Check email match
        if (invitation && user?.primaryEmailAddress?.emailAddress !== invitation.email) {
            setError(
                `This invitation was sent to ${invitation.email}. You are signed in as ${user?.primaryEmailAddress?.emailAddress}. Please sign in with the correct email address.`
            );
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/invite/${inviteCode}/accept`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${await getToken()}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setSuccess(true);

                // Redirect after 2 seconds
                setTimeout(() => {
                    navigate(data.redirectUrl || '/dashboard');
                }, 2000);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to accept invitation');
            }
        } catch {
            setError('Failed to accept invitation');
        } finally {
            setProcessing(false);
        }
    };

    const handleDeclineInvitation = async () => {
        if (!isSignedIn) {
            navigate('/');
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/invite/${inviteCode}/decline`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${await getToken()}`,
                    },
                }
            );

            if (response.ok) {
                navigate('/dashboard');
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to decline invitation');
            }
        } catch {
            setError('Failed to decline invitation');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted">
                <Card className="w-full max-w-md">
                    <CardContent className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle className="text-2xl">Welcome to the Team!</CardTitle>
                        <CardDescription>
                            You've successfully joined {invitation?.teamName}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-sm text-muted-foreground">
                            Redirecting you to the team page...
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !invitation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                            <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                        </div>
                        <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
                        <CardDescription className="text-red-600 dark:text-red-400">
                            {error || 'This invitation is no longer valid'}
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Button onClick={() => navigate('/')}>Go to Homepage</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    const expiryDate = new Date(invitation.expiresAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted p-4">
            <Card className="w-full max-w-2xl">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Shield className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle className="text-3xl">Team Invitation</CardTitle>
                    <CardDescription>
                        You've been invited to join a team on FairArena
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="bg-muted rounded-lg p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Organization</p>
                                <p className="text-base font-semibold">{invitation.organizationName}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Team</p>
                                <p className="text-base font-semibold">{invitation.teamName}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Your Role</p>
                                <p className="text-base font-semibold">{invitation.roleName}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Invited To</p>
                                <p className="text-base font-semibold">{invitation.email}</p>
                            </div>
                        </div>
                    </div>

                    {!isSignedIn && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                <strong>Note:</strong> You need to sign in or create an account with{' '}
                                <strong>{invitation.email}</strong> to accept this invitation.
                            </p>
                        </div>
                    )}

                    {isSignedIn && user?.primaryEmailAddress?.emailAddress !== invitation.email && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                <strong>Email Mismatch:</strong> This invitation was sent to{' '}
                                <strong>{invitation.email}</strong>, but you're signed in as{' '}
                                <strong>{user?.primaryEmailAddress?.emailAddress}</strong>. Please sign in with
                                the correct email address.
                            </p>
                        </div>
                    )}

                    <div className="border-t pt-4">
                        <p className="text-sm text-muted-foreground">
                            <strong>Expires:</strong> {expiryDate}
                        </p>
                    </div>
                </CardContent>

                <CardFooter className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleDeclineInvitation}
                        disabled={processing}
                        className="flex-1"
                    >
                        Decline
                    </Button>
                    <Button
                        onClick={handleAcceptInvitation}
                        disabled={processing || (isSignedIn && user?.primaryEmailAddress?.emailAddress !== invitation.email)}
                        className="flex-1"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : isSignedIn ? (
                            'Accept Invitation'
                        ) : (
                            'Sign In to Accept'
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default TeamInviteAcceptPage;
