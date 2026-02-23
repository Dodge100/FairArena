import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { apiRequest } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  CreditCard,
  Crown,
  ExternalLink,
  Gift,
  History,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Ticket as TicketIcon,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthState } from '../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditBalance {
  balance: number;
  userId: string;
}

interface CreditTransaction {
  id: string;
  amount: number;
  balance: number;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  payment?: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    planName: string;
    amount: number;
    status: string;
  };
}

interface CreditHistory {
  transactions: CreditTransaction[];
  total: number;
  limit: number;
  offset: number;
}

interface PaymentDetails {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  planName: string;
  amount: number;
  currency: string;
  credits: number;
  status: string;
  createdAt: string;
  completedAt?: string;
  invoiceUrl?: string;
}

interface CreditPlan {
  id: string;
  planId: string;
  name: string;
  amount: number;
  currency: string;
  credits: number;
  description?: string;
  features: string[];
  isActive: boolean;
}

// ─── Razorpay Types ───────────────────────────────────────────────────────────

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const CreditsPage = () => {
  const { isSignedIn } = useAuthState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sliderRef = useRef<HTMLDivElement>(null);

  const [selectedPayment, setSelectedPayment] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(2); // Default to middle plan
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return !!urlParams.get('refresh');
  });

  useEffect(() => {
    if (!isSignedIn) { navigate('/signin'); return; }
    if (isRefreshing) {
      window.history.replaceState({}, '', '/dashboard/credits');
      queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      queryClient.invalidateQueries({ queryKey: ['credits-history'] });
      queryClient.invalidateQueries({ queryKey: ['credits-eligibility'] });
      const timer = setTimeout(() => setIsRefreshing(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isSignedIn, navigate, queryClient, isRefreshing]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['credits-balance'],
    queryFn: () =>
      apiRequest<{ success: boolean; data: CreditBalance }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/balance`,
      ).then((res) => res.data),
    enabled: isSignedIn,
    refetchInterval: isRefreshing ? 1000 : false,
  });

  const { data: eligibilityData } = useQuery({
    queryKey: ['credits-eligibility'],
    queryFn: () =>
      apiRequest<{
        success: boolean;
        data: { canClaimFreeCredits: boolean; hasClaimedFreeCredits: boolean; phoneVerified: boolean };
      }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/check-eligibility`).then(
        (res) => res.data,
      ),
    enabled: isSignedIn,
    refetchInterval: isRefreshing ? 1000 : false,
  });

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['credit-plans'],
    queryFn: () =>
      apiRequest<{ success: boolean; plans: CreditPlan[] }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/plans`,
      ).then((res) => res.plans),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const {
    data: historyData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: historyLoading,
    error: historyError,
  } = useInfiniteQuery({
    queryKey: ['credits-history'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await apiRequest<{ success: boolean; data: CreditHistory }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/history?limit=20&offset=${pageParam}`,
      );
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled: isSignedIn,
    refetchInterval: isRefreshing ? 1000 : false,
  });

  const transactions = historyData?.pages.flatMap((page) => page.transactions) || [];

  useEffect(() => {
    if (historyError) {
      console.error('Error fetching credit history:', historyError);
      toast.error('Failed to load credit history');
    }
  }, [historyError]);

  // ── Plans ────────────────────────────────────────────────────────────────────

  const allActivePlans = plansData || [];
  // Filter out Enterprise (amount=0) plans from the slider — they get their own CTA
  const plans = allActivePlans.filter((p) => p.amount > 0);
  const selectedPlan = plans[Math.min(selectedPlanIndex, plans.length - 1)];

  // ── Purchase ─────────────────────────────────────────────────────────────────

  const handlePurchase = useCallback(async () => {
    if (!selectedPlan || isPurchasing) return;
    setIsPurchasing(true);

    try {
      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.body.appendChild(script);
        });
      }

      const orderData = await apiRequest<{
        success: boolean;
        order: { id: string; amount: number; currency: string; key: string };
        plan: { id: string; name: string; credits: number };
        serverAmount: number;
      }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan.planId }),
      });

      const rzp = new window.Razorpay({
        key: orderData.order.key,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'FairArena',
        description: `${orderData.plan.credits} Credits`,
        order_id: orderData.order.id,
        theme: { color: '#6366f1' },
        handler: async (response: Record<string, unknown>) => {
          try {
            await apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/payments/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            toast.success('Payment successful! Credits will be added shortly.');
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
              queryClient.invalidateQueries({ queryKey: ['credits-history'] });
            }, 3000);
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
      });

      rzp.on('payment.failed', () => {
        toast.error('Payment failed. Please try again.');
      });

      rzp.open();
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  }, [selectedPlan, isPurchasing, queryClient]);

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    setIsRedeeming(true);
    try {
      const result = await apiRequest<{
        success: boolean;
        message: string;
        data: { success: boolean; credits: number; planId?: string; durationDays?: number };
      }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/coupons/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      });

      if (result.success) {
        toast.success(result.message || 'Coupon redeemed successfully!');
        setCouponCode('');
        // Invalidate queries to refresh balance and history
        queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
        queryClient.invalidateQueries({ queryKey: ['credits-history'] });
        if (result.data.planId) {
          queryClient.invalidateQueries({ queryKey: ['user-subscription'] });
        }
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to redeem coupon');
    } finally {
      setIsRedeeming(false);
    }
  };

  // ── Payment Details ───────────────────────────────────────────────────────────

  const fetchPaymentDetails = useCallback((transaction: CreditTransaction) => {
    if (!transaction.payment) return;
    const paymentDetails: PaymentDetails = {
      id: transaction.id,
      razorpayOrderId: transaction.payment.razorpayOrderId,
      razorpayPaymentId: transaction.payment.razorpayPaymentId,
      planName: transaction.payment.planName,
      amount: transaction.payment.amount,
      currency: 'INR',
      credits: Math.abs(transaction.amount),
      status: transaction.payment.status,
      createdAt: transaction.createdAt,
    };
    setSelectedPayment(paymentDetails);
    setShowPaymentDialog(true);
  }, []);

  const getTransactionIcon = (type: string, amount: number) => {
    switch (type) {
      case 'PURCHASE': return <CreditCard className="h-4 w-4" />;
      case 'REFUND': return <RefreshCw className="h-4 w-4" />;
      case 'BONUS': return <Gift className="h-4 w-4" />;
      case 'COUPON_REDEMPTION': return <TicketIcon className="h-4 w-4" />;
      case 'DEDUCTION': return <TrendingDown className="h-4 w-4" />;
      default: return amount > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
    }
  };

  if (!isSignedIn) return null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Credits</h1>
            <p className="text-muted-foreground max-w-2xl">
              Purchase credits to power AI features. Credits never expire.
            </p>
          </div>
          <Button
            onClick={() => navigate('/dashboard/subscription')}
            variant="outline"
            className="shrink-0"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            View Subscription Plans
          </Button>
        </div>

        {/* Balance + Free Credits */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1 border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Available Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight">
                {balanceLoading ? (
                  <Skeleton className="h-10 w-24" />
                ) : (
                  balanceData?.balance.toLocaleString() || '0'
                )}
                <span className="text-lg font-normal text-muted-foreground ml-2">credits</span>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-4">
            {eligibilityData !== undefined && eligibilityData?.canClaimFreeCredits && (
              <Card className="border bg-secondary/30 shadow-none">
                <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Gift className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Claim Free Credits</h3>
                      <p className="text-muted-foreground text-sm">
                        Verify your phone and get 200 free credits.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate('/dashboard/credits/verify')}
                    variant="outline"
                    className="w-full sm:w-auto shrink-0"
                  >
                    Claim Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {eligibilityData !== undefined &&
              !eligibilityData?.hasClaimedFreeCredits &&
              !eligibilityData?.canClaimFreeCredits && (
                <Card className="border bg-secondary/30 shadow-none">
                  <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Shield className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Verify & Earn</h3>
                        <p className="text-muted-foreground text-sm">
                          Secure your account with phone verification and earn 200 credits.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate('/dashboard/credits/verify')}
                      variant="outline"
                      className="w-full sm:w-auto shrink-0"
                    >
                      Verify Phone <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )}
          </div>
        </div>

        {/* ── Credit Purchase Slider ─────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Buy Credits</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Drag the slider to choose the amount that fits your needs
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Never expire
            </Badge>
          </div>

          <Card className="border shadow-sm overflow-hidden">
            <CardContent className="p-6 sm:p-8 space-y-8">
              {plansLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <>
                  {/* Selected Plan Display */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold tracking-tight">
                          {selectedPlan?.credits.toLocaleString()}
                        </span>
                        <span className="text-xl text-muted-foreground font-medium">credits</span>
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">
                        {selectedPlan?.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-bold">
                        ₹{((selectedPlan?.amount || 0) / 100).toLocaleString('en-IN')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ₹{(((selectedPlan?.amount || 0) / 100) / (selectedPlan?.credits || 1)).toFixed(2)} per credit
                      </div>
                    </div>
                  </div>

                  {/* Slider */}
                  <div ref={sliderRef} className="space-y-3">
                    <Slider
                      min={0}
                      max={plans.length - 1}
                      step={1}
                      value={[selectedPlanIndex]}
                      onValueChange={([val]) => setSelectedPlanIndex(val)}
                      className="w-full"
                    />
                    {/* Plan labels */}
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                      {plans.map((plan, i) => (
                        <button
                          key={plan.planId}
                          onClick={() => setSelectedPlanIndex(i)}
                          className={cn(
                            'transition-colors font-medium',
                            i === selectedPlanIndex
                              ? 'text-foreground'
                              : 'hover:text-foreground/70',
                          )}
                        >
                          {plan.credits >= 1000
                            ? `${plan.credits / 1000}k`
                            : plan.credits}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  {selectedPlan?.features && selectedPlan.features.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedPlan.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Purchase Button */}
                  <Button
                    onClick={handlePurchase}
                    disabled={isPurchasing || !selectedPlan}
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                  >
                    {isPurchasing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Buy {selectedPlan?.credits.toLocaleString()} Credits for ₹
                        {((selectedPlan?.amount || 0) / 100).toLocaleString('en-IN')}
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Secured by Razorpay · Credits are non-refundable after use
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Coupon Redemption ───────────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Redeem Coupon</h2>
          </div>
          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Enter coupon code (e.g. WELCOME200)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="h-12 uppercase"
                    disabled={isRedeeming}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter a valid coupon code to get credits or premium subscriptions.
                  </p>
                </div>
                <Button
                  onClick={handleRedeemCoupon}
                  disabled={isRedeeming || !couponCode.trim()}
                  className="h-12 px-8 font-semibold"
                  variant="secondary"
                >
                  {isRedeeming ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Redeeming...
                    </>
                  ) : (
                    <>
                      <TicketIcon className="mr-2 h-4 w-4" />
                      Redeem
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Enterprise CTA ───────────────────────────────────────────────────── */}
        <Card className="border-2 border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-rose-500/10">
                <Crown className="h-6 w-6 text-rose-500" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Enterprise Plan</h4>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Unlimited credits, dedicated support &amp; custom integrations
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-2 shrink-0">
              <div className="text-2xl font-bold">Custom Pricing</div>
              <Button
                variant="outline"
                className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                onClick={() =>
                  window.open(
                    'mailto:contact@fairarena.app?subject=Enterprise Plan Inquiry',
                    '_blank',
                  )
                }
              >
                Contact Us <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Transaction History ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">History</h2>
          </div>

          <Card className="border shadow-none">
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-muted inline-flex p-4 rounded-full mb-4">
                    <History className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No transactions yet</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                    When you purchase or use credits, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 hover:bg-muted/50 transition-colors gap-4"
                      role={transaction.type === 'PURCHASE' ? 'button' : undefined}
                      onClick={() =>
                        transaction.type === 'PURCHASE' &&
                        transaction.payment &&
                        fetchPaymentDetails(transaction)
                      }
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div
                          className={cn(
                            'mt-1 p-2 rounded-full bg-secondary shrink-0',
                            transaction.type === 'PURCHASE'
                              ? 'text-green-600 dark:text-green-500'
                              : transaction.type === 'DEDUCTION'
                                ? 'text-red-600 dark:text-red-500'
                                : 'text-foreground',
                          )}
                        >
                          {getTransactionIcon(transaction.type, transaction.amount)}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate pr-2">
                            {transaction.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(transaction.createdAt).toLocaleDateString()}</span>
                            <span className="hidden sm:inline">•</span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 px-1.5 font-normal uppercase tracking-wider"
                            >
                              {transaction.type.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right pl-[52px] sm:pl-0">
                        <span
                          className={cn(
                            'font-semibold block',
                            transaction.amount > 0
                              ? 'text-green-600 dark:text-green-500'
                              : 'text-foreground',
                          )}
                        >
                          {transaction.amount > 0 ? '+' : ''}
                          {transaction.amount.toLocaleString()}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Bal: {transaction.balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {hasNextPage && (
              <div className="p-4 border-t text-center">
                <Button
                  variant="ghost"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load more transactions'}
                </Button>
              </div>
            )}
          </Card>
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

        {/* Payment Details Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>Receipt for credit purchase</DialogDescription>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4 pt-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={selectedPayment.status === 'captured' ? 'default' : 'secondary'}>
                      {selectedPayment.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">₹{selectedPayment.amount / 100}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Credits</span>
                    <span className="font-semibold">{selectedPayment.credits}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span>{new Date(selectedPayment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="border-t pt-3 mt-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Order ID</span>
                      <span className="font-mono">{selectedPayment.razorpayOrderId}</span>
                    </div>
                  </div>
                </div>
                {selectedPayment.invoiceUrl && (
                  <Button
                    onClick={() => window.open(selectedPayment.invoiceUrl, '_blank')}
                    className="w-full"
                    variant="outline"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Download Invoice
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CreditsPage;
