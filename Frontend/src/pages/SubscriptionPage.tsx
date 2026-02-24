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

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest, publicApiFetch } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertCircle,
    ArrowRight,
    Check,
    Crown,
    HelpCircle,
    Infinity as InfinityIcon,
    Loader2,
    RefreshCw,
    Shield,
    Sparkles,
    Star,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthState } from '../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionPlan {
    id: string;
    planId: string;
    razorpayPlanId: string | null;
    name: string;
    tier: 'FREE' | 'STARTER' | 'PRO' | 'TEAM' | 'ENTERPRISE';
    billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    amount: number;
    currency: string;
    description?: string;
    features: string[];
    limits: Record<string, unknown>;
    isPopular: boolean;
}

interface ActiveSubscriptionInfo {
    subscriptionId: string;
    razorpaySubscriptionId: string | null;
    tier: string;
    status: string;
    planId: string;
    planName: string;
    billingCycle: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;

}

// ... (skip types) ...

interface CurrentSubscriptionResponse {
    subscription: ActiveSubscriptionInfo | null;
    tier: string;
    isActive: boolean;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => {
    open: () => void;
    on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
};

const TIER_COLORS: Record<string, string> = {
    FREE: 'text-muted-foreground',
    STARTER: 'text-blue-500',
    PRO: 'text-violet-500',
    TEAM: 'text-amber-500',
    ENTERPRISE: 'text-rose-500',
};

const TIER_ICONS: Record<string, React.ReactNode> = {
    FREE: <Shield className="h-5 w-5" />,
    STARTER: <Zap className="h-5 w-5" />,
    PRO: <Star className="h-5 w-5" />,
    TEAM: <Sparkles className="h-5 w-5" />,
    ENTERPRISE: <Crown className="h-5 w-5" />,
};

const SubscriptionPage = () => {
    const { isSignedIn } = useAuthState();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
    const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancellingAtPeriodEnd, setCancellingAtPeriodEnd] = useState(true);
    const [showImmediateSwitchDialog, setShowImmediateSwitchDialog] = useState(false);
    const [pendingImmediatePlan, setPendingImmediatePlan] = useState<SubscriptionPlan | null>(null);
    const [showRevokeDialog, setShowRevokeDialog] = useState(false);

    useEffect(() => {
        if (!isSignedIn) navigate('/signin');
    }, [isSignedIn, navigate]);

    const {
        data: plansData,
        isLoading: plansLoading,
        isError: plansError,
        refetch: refetchPlans,
    } = useQuery({
        queryKey: ['subscription-plans'],
        queryFn: async () => {
            const res = await publicApiFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/subscriptions/plans`,
            );
            if (!res.ok) throw new Error('Failed to fetch plans');
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Failed to fetch plans');
            return data.plans as SubscriptionPlan[];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 2,
    });

    const { data: currentSubData, isLoading: subLoading } = useQuery({
        queryKey: ['current-subscription'],
        queryFn: () =>
            apiRequest<{ success: boolean; data: CurrentSubscriptionResponse }>(
                `${import.meta.env.VITE_API_BASE_URL}/api/v1/subscriptions/current`,
            ).then((res) => res.data),
        enabled: isSignedIn,
        // vital: set staleTime to 0 so we always hit the backend to trigger self-healing checks
        staleTime: 0,
        // Poll aggressively (every 3s) if we are waiting for activation
        refetchInterval: (query) => {
            const sub = query.state.data?.subscription;
            return sub?.status === 'AUTHENTICATED' ? 3000 : false;
        },
        refetchIntervalInBackground: true,
    });

    const allPlans = plansData ?? [];
    const plans = allPlans.filter(
        (p) => p.billingCycle === billingCycle || p.tier === 'ENTERPRISE',
    );

    const currentSub = currentSubData?.subscription ?? null;
    const currentTier = currentSubData?.tier ?? 'FREE';

    const loadRazorpay = async () => {
        if (window.Razorpay) return;
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
            document.body.appendChild(script);
        });
    };

    const openRazorpayCheckout = useCallback(
        async (plan: SubscriptionPlan) => {
            setSubscribingPlanId(plan.planId);
            try {
                await loadRazorpay();

                const createData = await apiRequest<{
                    success: boolean;
                    data: {
                        subscriptionId: string;
                        razorpaySubscriptionId: string;
                        razorpayKeyId: string;
                        plan: { id: string; name: string; tier: string; amount: number; currency: string; billingCycle: string };
                        userInfo: { name: string; email: string; contact: string };
                    };
                }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/subscriptions/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planId: plan.planId }),
                });

                const { razorpaySubscriptionId, razorpayKeyId, userInfo } = createData.data;

                const rzp = new (window.Razorpay as unknown as RazorpayConstructor)({
                    key: razorpayKeyId,
                    subscription_id: razorpaySubscriptionId,
                    name: 'FairArena',
                    description: `${plan.name} — ${plan.billingCycle.charAt(0) + plan.billingCycle.slice(1).toLowerCase()}`,
                    prefill: {
                        name: userInfo.name,
                        email: userInfo.email,
                        contact: userInfo.contact,
                    },
                    theme: { color: '#6366f1' },
                    handler: async (response: Record<string, unknown>) => {
                        const verifyToast = toast.loading('Verifying payment with Razorpay...');
                        try {
                            await apiRequest(
                                `${import.meta.env.VITE_API_BASE_URL}/api/v1/subscriptions/verify`,
                                {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        razorpay_subscription_id: response.razorpay_subscription_id,
                                        razorpay_payment_id: response.razorpay_payment_id,
                                        razorpay_signature: response.razorpay_signature,
                                    }),
                                },
                            );
                            toast.dismiss(verifyToast);
                            toast.success(`✅ Payment verified! Your ${plan.name} plan is activating — benefits will be available within a minute.`, { duration: 6000 });
                            queryClient.invalidateQueries({ queryKey: ['current-subscription'] });
                        } catch (err: unknown) {
                            toast.dismiss(verifyToast);
                            const e = err as { data?: { message?: string } };
                            toast.error(e?.data?.message ?? 'Verification failed. Please contact support if payment was deducted.', { duration: 8000 });
                        }
                    },
                });

                rzp.on('payment.failed', () => {
                    toast.error('Payment failed. Please try again.');
                });

                rzp.open();
            } catch (error: unknown) {
                const err = error as { data?: { message?: string; code?: string } };
                const msg = err?.data?.message ?? 'Failed to initiate subscription. Please try again.';
                toast.error(msg);
                console.error('Subscribe error:', error);
            } finally {
                setSubscribingPlanId(null);
            }
        },
        [queryClient],
    );

    const handleSubscribe = useCallback(
        (plan: SubscriptionPlan) => {
            if (!isSignedIn) { navigate('/signin'); return; }
            if (plan.tier === 'ENTERPRISE') {
                window.open('mailto:contact@fairarena.app?subject=Enterprise Plan Inquiry', '_blank');
                return;
            }
            if (subscribingPlanId) return;

            // If user has an active paid subscription, confirm switch
            // (If tier is FREE or no sub, we just proceed)
            if (currentSub && currentSub.tier !== 'FREE') {
                setPendingImmediatePlan(plan);
                setShowImmediateSwitchDialog(true);
                return;
            }

            openRazorpayCheckout(plan);
        },
        [isSignedIn, navigate, subscribingPlanId, currentSub, openRazorpayCheckout],
    );

    const cancelMutation = useMutation({
        mutationFn: (cancelAtPeriodEnd: boolean) =>
            apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/subscriptions/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancelAtPeriodEnd, reason: 'User requested cancellation' }),
            }),
        onSuccess: (_data, cancelAtPeriodEnd) => {
            toast.success(
                cancelAtPeriodEnd
                    ? 'Subscription will be cancelled at the end of your billing period. You keep access until then.'
                    : 'Subscription cancelled immediately. Access has been revoked.',
            );
            queryClient.invalidateQueries({ queryKey: ['current-subscription'] });
            setShowCancelDialog(false);
            setShowRevokeDialog(false);
        },
        onError: () => {
            toast.error('Failed to cancel subscription. Please try again.');
        },
    });

    return (
        <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-12">

                {/* ... Header ... */}
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Subscription Plans</h1>
                    <p className="text-muted-foreground text-lg">
                        Unlock the full power of FairArena. Cancel anytime.
                    </p>

                    {/* Billing Toggle */}
                    <div className="flex justify-center pt-2">
                        <Tabs
                            value={billingCycle}
                            onValueChange={(v) => setBillingCycle(v as 'MONTHLY' | 'YEARLY')}
                        >
                            <TabsList className="h-10">
                                <TabsTrigger value="MONTHLY" className="px-6">Monthly</TabsTrigger>
                                <TabsTrigger value="YEARLY" className="px-6">
                                    Yearly
                                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">Save 20%</Badge>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {/* Pending Activation Banner — shown when payment done but webhook not yet fired */}
                {!subLoading && currentSub && currentSub.status === 'AUTHENTICATED' && (
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                        <AlertDescription className="text-amber-700 dark:text-amber-400">
                            <strong>Activating your plan…</strong> Your payment was verified. Razorpay is processing the charge — your {currentSub.planName} benefits will be available within 1–2 minutes. This page will update automatically.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Current Subscription Banner */}
                {!subLoading && currentSub && (
                    <div className="space-y-4">
                        <Card className={cn(
                            'border shadow-none',
                            currentSub.status === 'AUTHENTICATED' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-secondary/30',
                        )}>
                            <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={cn('p-2 bg-background rounded-full border', TIER_COLORS[currentSub.tier])}>
                                        {TIER_ICONS[currentSub.tier]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold">{currentSub.planName}</h3>
                                            <Badge
                                                variant={currentSub.status === 'AUTHENTICATED' ? 'secondary' : 'outline'}
                                                className="text-xs capitalize"
                                            >
                                                {currentSub.status === 'AUTHENTICATED' ? '⏳ Pending activation' : currentSub.status.toLowerCase()}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {currentSub.billingCycle.toLowerCase()}
                                            </Badge>
                                            {currentSub.cancelAtPeriodEnd && (
                                                <Badge variant="destructive" className="text-xs">
                                                    Cancels {currentSub.currentPeriodEnd
                                                        ? new Date(currentSub.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                                        : 'at period end'}
                                                </Badge>
                                            )}
                                        </div>
                                        {currentSub.currentPeriodEnd && currentSub.status !== 'AUTHENTICATED' && (
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                {currentSub.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}{' '}
                                                {new Date(currentSub.currentPeriodEnd).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'long', year: 'numeric',
                                                })}
                                            </p>
                                        )}
                                        {currentSub.status === 'AUTHENTICATED' && (
                                            <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                                                Payment received — awaiting Razorpay activation
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                    {/* Show Cancel button only for ACTIVE subs not yet scheduled to cancel */}
                                    {currentSub.status === 'ACTIVE' && !currentSub.cancelAtPeriodEnd && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowCancelDialog(true)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            Cancel Subscription
                                        </Button>
                                    )}
                                    {/* Show Revoke button when already scheduled to cancel — lets user pull the plug immediately */}
                                    {currentSub.status === 'ACTIVE' && currentSub.cancelAtPeriodEnd && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowRevokeDialog(true)}
                                            className="text-destructive hover:text-destructive border-destructive/50"
                                        >
                                            Revoke Access Now
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Plans Error */}
                {plansError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between">
                            <span>Failed to load subscription plans.</span>
                            <Button variant="outline" size="sm" onClick={() => refetchPlans()}>
                                Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Plans Grid */}
                {plansLoading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i} className="border">
                                <CardHeader className="space-y-3">
                                    <Skeleton className="h-6 w-24" />
                                    <Skeleton className="h-8 w-32" />
                                    <Skeleton className="h-4 w-full" />
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {[1, 2, 3, 4].map((j) => <Skeleton key={j} className="h-4 w-full" />)}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : plans.length === 0 && !plansError ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <p>No plans available for this billing cycle.</p>
                    </div>
                ) : (
                    <>
                        {/* Regular plans — responsive grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plans
                                .filter((p) => p.tier !== 'ENTERPRISE')
                                .map((plan) => {
                                    const isCurrentPlan = currentSub?.planId === plan.planId;
                                    const isSameTierDifferentCycle =
                                        !isCurrentPlan &&
                                        currentSub &&
                                        currentTier === plan.tier &&
                                        currentSub.billingCycle !== plan.billingCycle;
                                    const isSubscribing = subscribingPlanId === plan.planId;
                                    const hasActiveSub = !!currentSub;
                                    const showSwitch = hasActiveSub && !isCurrentPlan;

                                    const displayMonthlyPrice =
                                        plan.billingCycle === 'YEARLY'
                                            ? Math.round(plan.amount / 12 / 100)
                                            : Math.round(plan.amount / 100);

                                    return (
                                        <Card
                                            key={plan.planId}
                                            className={cn(
                                                'relative flex flex-col border transition-all duration-200',
                                                plan.isPopular && 'border-primary shadow-md ring-1 ring-primary/20',
                                                isCurrentPlan && 'border-green-500/50 bg-green-500/5',
                                            )}
                                        >
                                            {plan.isPopular && !isCurrentPlan && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                    <Badge className="bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold">
                                                        Most Popular
                                                    </Badge>
                                                </div>
                                            )}
                                            {isCurrentPlan && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                    <Badge className="bg-green-600 text-white px-3 py-0.5 text-xs font-semibold">
                                                        Current Plan
                                                    </Badge>
                                                </div>
                                            )}

                                            <CardHeader className="pb-4 pt-6">
                                                <div className={cn('flex items-center gap-2 mb-2', TIER_COLORS[plan.tier])}>
                                                    {TIER_ICONS[plan.tier]}
                                                    <span className="font-semibold text-sm uppercase tracking-wider">{plan.name}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-3xl font-bold">
                                                            ₹{displayMonthlyPrice.toLocaleString('en-IN')}
                                                        </span>
                                                        <span className="text-muted-foreground text-sm">/mo</span>
                                                    </div>
                                                    {plan.billingCycle === 'YEARLY' && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            ₹{Math.round(plan.amount / 100).toLocaleString('en-IN')} billed yearly
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                                    {plan.description}
                                                </p>
                                            </CardHeader>

                                            <CardContent className="flex-1 space-y-2.5">
                                                {plan.features.map((feature) => (
                                                    <div key={feature} className="flex items-start gap-2 text-sm">
                                                        {feature.startsWith('Unlimited') ? (
                                                            <InfinityIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                        ) : (
                                                            <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                                        )}
                                                        <span className="text-muted-foreground leading-snug">{feature}</span>
                                                    </div>
                                                ))}
                                            </CardContent>

                                            <CardFooter className="pt-4 flex flex-col gap-2">
                                                {isCurrentPlan ? (
                                                    <Button variant="outline" className="w-full" disabled>
                                                        <Check className="mr-2 h-4 w-4 text-green-500" />
                                                        Current Plan
                                                    </Button>
                                                ) : showSwitch ? (
                                                    <Button
                                                        className="w-full"
                                                        variant="outline"
                                                        onClick={() => handleSubscribe(plan)}
                                                        disabled={isSubscribing || !!subscribingPlanId}
                                                    >
                                                        {isSameTierDifferentCycle ? (
                                                            <>
                                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                                Switch to {plan.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'}
                                                            </>
                                                        ) : (
                                                            <>
                                                                Switch to {plan.name} <ArrowRight className="ml-2 h-4 w-4" />
                                                            </>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <div className="w-full space-y-2">
                                                        <Button
                                                            className={cn('w-full', plan.isPopular && 'bg-primary hover:bg-primary/90')}
                                                            onClick={() => handleSubscribe(plan)}
                                                            disabled={isSubscribing || !!subscribingPlanId}
                                                        >
                                                            {isSubscribing ? (
                                                                <>
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    Processing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Get {plan.name}
                                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                )}
                                            </CardFooter>
                                        </Card>
                                    );
                                })}
                        </div>

                        {/* Enterprise — full-width banner */}
                        {plans.some((p) => p.tier === 'ENTERPRISE') && (
                            <div className="mt-6 rounded-xl border-2 border-rose-500/30 bg-rose-500/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-full bg-rose-500/10 shrink-0">
                                        <Crown className="h-6 w-6 text-rose-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-lg">Enterprise Plan</h3>
                                            <Badge variant="outline" className="text-rose-500 border-rose-500/50 text-xs">
                                                Custom
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Unlimited scale, dedicated SLA support, custom integrations & white-glove onboarding
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                            {plans
                                                .find((p) => p.tier === 'ENTERPRISE')
                                                ?.features.slice(0, 4)
                                                .map((f) => (
                                                    <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <InfinityIcon className="h-3 w-3 text-rose-500 shrink-0" />
                                                        {f}
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center sm:items-end gap-2 shrink-0">
                                    <div className="text-2xl font-bold">Custom Pricing</div>
                                    <Button
                                        variant="outline"
                                        className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                                        onClick={() => window.open('mailto:contact@fairarena.app?subject=Enterprise Plan Inquiry', '_blank')}
                                    >
                                        Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Feature Comparison Note */}
                <div className="text-center text-sm text-muted-foreground space-y-2">
                    <p>
                        Need help choosing?{' '}
                        <a
                            href="mailto:support@fairarena.app"
                            className="text-primary hover:underline"
                        >
                            Talk to our team
                        </a>
                    </p>
                </div>

                {/* FAQ Section */}
                <div className="space-y-6 max-w-2xl mx-auto">
                    <h2 className="text-xl font-semibold tracking-tight text-center">Common Questions</h2>
                    <div className="space-y-4">
                        {[
                            {
                                q: 'Can I cancel anytime?',
                                a: 'Yes. You can cancel your subscription at any time. Your plan remains active until the end of the current billing period.',
                            },
                            {
                                q: 'How do I switch plans?',
                                a: 'Click "Switch to Plan" on the plan you want. Your current subscription will be cancelled immediately and the new plan activates as soon as payment completes.',
                            },
                            {
                                q: 'What happens to my credits if I cancel?',
                                a: 'Credits purchased separately are yours to keep. Subscription-included monthly credits expire at the end of each billing period.',
                            },
                            {
                                q: 'Is there a free plan?',
                                a: 'Yes! You can use FairArena for free with limited features. Purchase credits separately for AI features.',
                            },
                        ].map(({ q, a }) => (
                            <div key={q} className="border rounded-lg p-4 space-y-2">
                                <div className="flex items-start gap-3">
                                    <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-sm">{q}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{a}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex gap-4">
                        <Link to="/terms-and-conditions" className="hover:underline">Terms</Link>
                        <Link to="/privacy-policy" className="hover:underline">Privacy</Link>
                        <Link to="/refund" className="hover:underline">Refunds</Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3" />
                        <span>Secured by Razorpay</span>
                    </div>
                </div>
            </div>

            {/* Cancel Dialog */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancel Subscription</DialogTitle>
                        <DialogDescription>
                            Choose how you'd like to cancel your{' '}
                            <strong>{currentSub?.planName}</strong> subscription.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-3">
                            <button
                                onClick={() => setCancellingAtPeriodEnd(true)}
                                className={cn(
                                    'w-full text-left p-4 rounded-lg border transition-colors',
                                    cancellingAtPeriodEnd ? 'border-primary bg-primary/5' : 'hover:bg-muted',
                                )}
                            >
                                <div className="font-medium text-sm">Cancel at period end</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Keep access until{' '}
                                    {currentSub?.currentPeriodEnd
                                        ? new Date(currentSub.currentPeriodEnd).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'long', year: 'numeric',
                                        })
                                        : 'the end of your billing period'}.
                                </div>
                            </button>
                            <button
                                onClick={() => setCancellingAtPeriodEnd(false)}
                                className={cn(
                                    'w-full text-left p-4 rounded-lg border transition-colors',
                                    !cancellingAtPeriodEnd ? 'border-destructive bg-destructive/5' : 'hover:bg-muted',
                                )}
                            >
                                <div className="font-medium text-sm text-destructive">Cancel immediately</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Lose access right away. No refunds for unused time.
                                </div>
                            </button>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setShowCancelDialog(false)}
                            >
                                Keep Subscription
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={() => cancelMutation.mutate(cancellingAtPeriodEnd)}
                                disabled={cancelMutation.isPending}
                            >
                                {cancelMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Confirm Cancel'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Revoke Access Now Dialog — for subs already scheduled to cancel at period end */}
            <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Revoke Access Immediately?</DialogTitle>
                        <DialogDescription>
                            Your subscription is currently scheduled to cancel at the end of your billing period.
                            <br /><br />
                            <span className="text-destructive font-medium">Warning:</span> Revoking immediately will{' '}
                            <strong>cut off all access right now</strong>. There are no refunds for unused time.
                            <br /><br />
                            Are you sure you want to lose access to <strong>{currentSub?.planName}</strong> immediately?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowRevokeDialog(false)}
                        >
                            Keep Access Until Period End
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => cancelMutation.mutate(false)}
                            disabled={cancelMutation.isPending}
                        >
                            {cancelMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Revoke Now — No Refund'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Immediate Switch Confirmation Dialog */}
            <Dialog open={showImmediateSwitchDialog} onOpenChange={(open) => !open && setShowImmediateSwitchDialog(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Switch Plan Immediately?</DialogTitle>
                        <DialogDescription>
                            You are about to switch to <strong>{pendingImmediatePlan?.name}</strong> immediately.
                            <br /><br />
                            <span className="text-destructive font-medium">Warning:</span> Your current subscription will end <strong>immediately</strong>. You will lose access to your current benefits right away.
                            <br /><br />
                            The new plan will be active as soon as payment is completed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowImmediateSwitchDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            className="flex-1"
                            onClick={() => {
                                setShowImmediateSwitchDialog(false);
                                if (pendingImmediatePlan) {
                                    openRazorpayCheckout(pendingImmediatePlan);
                                }
                            }}
                        >
                            Confirm Switch
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SubscriptionPage;
