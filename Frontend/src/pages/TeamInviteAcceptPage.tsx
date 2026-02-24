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

import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Shield, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { apiRequest } from '../lib/apiClient';
import { useAuthState } from '../lib/auth';

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
  const { isSignedIn, user } = useAuthState();
  const [success, setSuccess] = useState(false);
  const [emailMismatchError, setEmailMismatchError] = useState<string | null>(null);

  const {
    data: invitation,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['invite', inviteCode],
    queryFn: () =>
      apiRequest<{ invitation: InvitationDetails }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/invite/${inviteCode}`,
      ).then((res) => res.invitation),
    enabled: !!inviteCode,
    retry: false,
  });

  const error = queryError ? (queryError as any).message || 'Invalid or expired invitation' : null;

  useEffect(() => {
    if (invitation && user?.email && invitation.email !== user.email) {
      setEmailMismatchError(
        `This invitation was sent to ${invitation.email}. You are signed in as ${user.email}. Please sign in with the correct email address.`,
      );
    } else {
      setEmailMismatchError(null);
    }
  }, [invitation, user]);

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ redirectUrl: string }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/invite/${inviteCode}/accept`,
        {
          method: 'POST',
        },
      ),
    onSuccess: (data) => {
      setSuccess(true);
      setTimeout(() => {
        navigate(data.redirectUrl || '/dashboard');
      }, 2000);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to accept invitation');
    },
  });

  const declineMutation = useMutation({
    mutationFn: () =>
      apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/team/invite/${inviteCode}/decline`, {
        method: 'POST',
      }),
    onSuccess: () => {
      toast.success('Invitation declined');
      navigate('/dashboard');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to decline invitation');
    },
  });

  const handleAcceptInvitation = () => {
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (emailMismatchError) {
      toast.error(emailMismatchError);
      return;
    }
    acceptMutation.mutate();
  };

  const handleDeclineInvitation = () => {
    if (!isSignedIn) {
      navigate('/');
      return;
    }
    declineMutation.mutate();
  };

  const processing = acceptMutation.isPending || declineMutation.isPending;

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
            <CardDescription>You've successfully joined {invitation?.teamName}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">Redirecting you to the team page...</p>
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
          <CardDescription>You've been invited to join a team on FairArena</CardDescription>
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

          {isSignedIn && user?.email !== invitation.email && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Email Mismatch:</strong> This invitation was sent to{' '}
                <strong>{invitation.email}</strong>, but you're signed in as{' '}
                <strong>{user?.email}</strong>. Please sign in with the correct email address.
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
            disabled={processing || (isSignedIn && user?.email !== invitation.email)}
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
