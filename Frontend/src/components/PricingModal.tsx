import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Crown,
  Infinity as InfinityIcon,
  Loader2,
  Shield,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Slider } from '../components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuthState } from '../lib/auth';
import type { PaymentPlan, SubscriptionPlan } from '../services/paymentService';
import { paymentService } from '../services/paymentService';
import PaymentFailureModal from './PaymentFailureModal';
import PaymentSuccessModal from './PaymentSuccessModal';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SuccessPaymentData {
  planName: string;
  credits: number;
  amount: number;
  currency: string;
  orderId: string;
  paymentId: string;
}

interface FailurePaymentData {
  planName: string;
  amount: number;
  currency: string;
  orderId?: string;
  errorMessage: string;
}

interface RazorpayOptions {
  key: string;
  name: string;
  description?: string;
  order_id: string;
  handler?: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
  notes?: Record<string, string>;
  theme?: { color?: string };
}

const TIER_COLORS: Record<string, string> = {
  FREE: 'text-muted-foreground',
  STARTER: 'text-blue-500',
  PRO: 'text-violet-500',
  TEAM: 'text-amber-500',
  ENTERPRISE: 'text-rose-500',
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  FREE: <Shield className="h-4 w-4" />,
  STARTER: <Zap className="h-4 w-4" />,
  PRO: <Star className="h-4 w-4" />,
  TEAM: <Sparkles className="h-4 w-4" />,
  ENTERPRISE: <Crown className="h-4 w-4" />,
};

const TIER_ORDER: Record<string, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  TEAM: 3,
  ENTERPRISE: 4,
};

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { t } = useTranslation();
  const { isSignedIn, getToken } = useAuthState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // All credit plans (including enterprise)
  const [allCreditPlans, setAllCreditPlans] = useState<PaymentPlan[]>([]);
  const [subPlans, setSubPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPaymentData, setSuccessPaymentData] = useState<SuccessPaymentData | null>(null);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failurePaymentData, setFailurePaymentData] = useState<FailurePaymentData | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PaymentPlan | SubscriptionPlan | null>(null);

  const [activeTab, setActiveTab] = useState<'subscriptions' | 'credits'>('subscriptions');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [creditIndex, setCreditIndex] = useState(0);

  const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === 'true';

  // Purchasable credit plans (no Enterprise/amount=0)
  const creditPlans = allCreditPlans.filter((p) => p.isActive && p.amount > 0);
  const selectedCreditPlan = creditPlans[Math.min(creditIndex, creditPlans.length - 1)];

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoadingPlans(true);
        const [fetchedPlans, fetchedSubPlans] = await Promise.all([
          paymentService.getAllPlans(),
          paymentService.fetchSubscriptionPlans(),
        ]);
        setAllCreditPlans(fetchedPlans);
        setSubPlans(fetchedSubPlans);

        const purchasable = fetchedPlans.filter((p) => p.isActive && p.amount > 0);
        if (purchasable.length > 0) {
          setCreditIndex(Math.floor(purchasable.length / 2));
        }
      } catch (error) {
        console.error('Failed to fetch plans:', error);
        toast.error('Failed to load pricing plans');
      } finally {
        setLoadingPlans(false);
      }
    };

    if (isOpen) {
      fetchAllData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => setRazorpayLoaded(true);
      script.onerror = () => {
        console.error('Failed to load Razorpay script');
        toast.error('Payment system unavailable');
      };
      document.body.appendChild(script);
    } else {
      setRazorpayLoaded(true);
    }
  }, []);

  const handlePayment = async (plan: PaymentPlan) => {
    if (!paymentsEnabled) {
      toast.error(t('pricing.disabled'));
      return;
    }
    if (navigator.vibrate) navigator.vibrate(50);

    if (!razorpayLoaded) {
      toast.error('Payment system is loading. Please try again.');
      return;
    }

    if (plan.amount === 0) {
      window.open('mailto:enterprise@fairarena.app?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    setLoadingPlan(plan.id);
    setCurrentPlan(plan);

    try {
      const token = await getToken();
      if (!isSignedIn || !token) {
        navigate('/signin');
        onClose();
        return;
      }

      const orderResponse = await paymentService.createOrder(plan.planId, token);

      if (!orderResponse.success || !orderResponse.order) {
        throw new Error(orderResponse.message || 'Failed to create order');
      }

      onClose();

      setTimeout(() => {
        const { order } = orderResponse;

        if (!order || order.amount !== plan.amount) {
          console.error('Amount mismatch detected', {
            expected: plan.amount,
            received: order?.amount,
            planId: plan.planId,
          });
          toast.error('Payment amount validation failed. Please try again.');
          return;
        }

        type RazorpayType = new (options: RazorpayOptions) => { open: () => void };
        const RazorpayConstructor = window.Razorpay as unknown as RazorpayType;

        const options: RazorpayOptions = {
          key: order!.key,
          order_id: order!.id,
          name: 'FairArena',
          description: `Payment for ${plan.name}`,
          handler: async (response) => {
            try {
              const freshToken = await getToken();
              if (!freshToken) {
                setFailurePaymentData({
                  planName: plan.name,
                  amount: plan.amount,
                  currency: plan.currency,
                  orderId: response.razorpay_order_id,
                  errorMessage: 'Authentication session expired. Please sign in again and retry.',
                });
                setShowFailureModal(true);
                return;
              }

              const verifyResult = await paymentService.verifyPayment(
                {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
                freshToken,
              );

              if (verifyResult.success && verifyResult.data) {
                queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
                queryClient.invalidateQueries({ queryKey: ['credits-history'] });
                queryClient.invalidateQueries({ queryKey: ['credits-eligibility'] });

                setSuccessPaymentData({
                  planName: verifyResult.data.planName,
                  credits: verifyResult.data.credits,
                  amount: verifyResult.data.amount,
                  currency: verifyResult.data.currency,
                  orderId: verifyResult.data.orderId,
                  paymentId: verifyResult.data.paymentId,
                });
                setShowSuccessModal(true);
              } else {
                setFailurePaymentData({
                  planName: plan.name,
                  amount: plan.amount,
                  currency: plan.currency,
                  orderId: response.razorpay_order_id,
                  errorMessage: verifyResult.message || 'Payment verification failed.',
                });
                setShowFailureModal(true);
              }
            } catch (error: unknown) {
              console.error('Payment verification failed:', error);
              let errorMessage = 'Payment verification failed.';
              if (typeof error === 'object' && error !== null) {
                // @ts-expect-error: dynamic error shape
                errorMessage = error?.response?.data?.message || error?.message || errorMessage;
              }
              setFailurePaymentData({
                planName: plan.name,
                amount: plan.amount,
                currency: plan.currency,
                orderId: response.razorpay_order_id,
                errorMessage,
              });
              setShowFailureModal(true);
            }
          },
          modal: {
            ondismiss: () => {
              setFailurePaymentData({
                planName: plan.name,
                amount: plan.amount,
                currency: plan.currency,
                errorMessage: 'Payment was cancelled. No amount has been charged.',
              });
              setShowFailureModal(true);
            },
          },
          theme: { color: '#d9ff00' },
        };

        const rzp = new RazorpayConstructor(options);
        rzp.open();
      }, 100);
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSubscriptionClick = (plan: SubscriptionPlan) => {
    if (!isSignedIn) {
      navigate('/signin');
      return;
    }
    onClose();
    navigate('/dashboard/subscription', { state: { selectedPlanId: plan.planId } });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto z-50 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-xl sm:text-2xl font-bold text-[#d9ff00]">
              {t('pricing.title')}
            </DialogTitle>
            <p className="text-center text-muted-foreground text-sm">{t('pricing.subtitle')}</p>
            {!paymentsEnabled && (
              <div className="text-center mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-600 dark:text-yellow-400 font-medium text-sm">
                  {t('pricing.disabled')}
                </p>
              </div>
            )}
          </DialogHeader>

          <div className="mt-6">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'subscriptions' | 'credits')}
              className="w-full"
            >
              <div className="flex justify-center mb-6">
                <TabsList className="bg-muted/50 p-1 rounded-xl">
                  <TabsTrigger
                    value="subscriptions"
                    className="px-5 py-2 text-sm data-[state=active]:bg-[#d9ff00] data-[state=active]:text-black"
                  >
                    Subscriptions
                  </TabsTrigger>
                  <TabsTrigger
                    value="credits"
                    className="px-5 py-2 text-sm data-[state=active]:bg-[#d9ff00] data-[state=active]:text-black"
                  >
                    Credits
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── Subscriptions Tab ── */}
              <TabsContent value="subscriptions">
                <div className="flex justify-center mb-6">
                  <div className="inline-flex items-center p-1 bg-muted/40 rounded-lg border border-border">
                    <button
                      onClick={() => setBillingCycle('MONTHLY')}
                      className={cn(
                        'px-4 py-1.5 rounded-md text-xs font-bold transition-all',
                        billingCycle === 'MONTHLY'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle('YEARLY')}
                      className={cn(
                        'px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5',
                        billingCycle === 'YEARLY'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      Yearly
                      <Badge
                        variant="secondary"
                        className="bg-[#d9ff00]/20 text-[#d9ff00] border-none text-[9px] px-1 py-0"
                      >
                        Save 20%
                      </Badge>
                    </button>
                  </div>
                </div>

                {loadingPlans ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#d9ff00]" />
                  </div>
                ) : (
                  <>
                    {/* Regular plans grid — responsive: 1 col mobile, 2 col sm, 3 col lg */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subPlans
                        .filter(
                          (p) =>
                            (p.billingCycle === billingCycle || p.tier === 'FREE') &&
                            p.tier !== 'ENTERPRISE',
                        )
                        .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
                        .map((plan) => {
                          const displayPrice =
                            plan.billingCycle === 'YEARLY'
                              ? Math.round(plan.amount / 12 / 100)
                              : Math.round(plan.amount / 100);

                          return (
                            <Card
                              key={plan.id}
                              className={cn(
                                'relative transition-all duration-200 hover:shadow-lg flex flex-col',
                                plan.isPopular
                                  ? 'border-[#d9ff00] border-2 shadow-[0_0_15px_rgba(217,255,0,0.1)]'
                                  : '',
                              )}
                            >
                              {plan.isPopular && (
                                <div className="absolute -top-3 left-0 right-0 flex justify-center z-30">
                                  <span className="bg-[#d9ff00] text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                                    Most Popular
                                  </span>
                                </div>
                              )}

                              <CardHeader className="pb-3 pt-6">
                                <div
                                  className={cn(
                                    'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-2',
                                    TIER_COLORS[plan.tier],
                                  )}
                                >
                                  {TIER_ICONS[plan.tier]}
                                  {plan.tier}
                                </div>
                                <div className="text-base font-bold">{plan.name}</div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {plan.description}
                                </p>
                                <div className="mt-3">
                                  {plan.amount === 0 ? (
                                    <div className="text-2xl font-bold">Free</div>
                                  ) : (
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-base font-bold">₹</span>
                                      <span className="text-2xl font-bold">
                                        {displayPrice.toLocaleString('en-IN')}
                                      </span>
                                      <span className="text-muted-foreground text-xs">/mo</span>
                                    </div>
                                  )}
                                  {plan.billingCycle === 'YEARLY' && plan.amount > 0 && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      ₹{Math.round(plan.amount / 100).toLocaleString('en-IN')}{' '}
                                      billed yearly
                                    </div>
                                  )}
                                </div>
                              </CardHeader>

                              <CardContent className="flex-1 flex flex-col justify-between pt-0 pb-4">
                                <ul className="space-y-1.5 mb-4">
                                  {plan.features.slice(0, 5).map((feature, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      {feature.startsWith('Unlimited') ? (
                                        <InfinityIcon className="h-3 w-3 text-[#d9ff00] mt-0.5 shrink-0" />
                                      ) : (
                                        <Check className="h-3 w-3 text-[#d9ff00] mt-0.5 shrink-0" />
                                      )}
                                      <span className="text-xs text-muted-foreground leading-snug">
                                        {feature}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                <Button
                                  onClick={() => handleSubscriptionClick(plan)}
                                  className={cn(
                                    'w-full h-9 text-xs font-bold',
                                    plan.isPopular
                                      ? 'bg-[#d9ff00] text-black hover:bg-[#c0e600]'
                                      : 'bg-primary',
                                  )}
                                >
                                  Get {plan.name}
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>

                    {/* Enterprise — full-width banner */}
                    {subPlans.some((p) => p.tier === 'ENTERPRISE') && (
                      <div className="mt-4 rounded-xl border-2 border-rose-500/30 bg-rose-500/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-full bg-rose-500/10 shrink-0">
                            <Crown className="h-5 w-5 text-rose-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-sm">Enterprise Plan</span>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                                Custom
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Unlimited scale, dedicated SLA support & custom integrations
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
                          <div className="text-xl font-bold">Custom Pricing</div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 text-xs"
                            onClick={() =>
                              window.open(
                                'mailto:enterprise@fairarena.app?subject=Enterprise Plan Inquiry',
                                '_blank',
                              )
                            }
                          >
                            Contact Sales <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── Credits Tab ── */}
              <TabsContent value="credits">
                {loadingPlans ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#d9ff00]" />
                  </div>
                ) : creditPlans.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No credit plans available.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Slider section */}
                    <div className="bg-muted/20 rounded-2xl border border-border p-5 sm:p-8 space-y-6">
                      {/* Plan display */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold tracking-tight">
                              {selectedCreditPlan?.credits.toLocaleString()}
                            </span>
                            <span className="text-lg text-muted-foreground font-medium">
                              credits
                            </span>
                          </div>
                          <p className="text-muted-foreground text-sm mt-1">
                            {selectedCreditPlan?.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-3xl font-bold">
                            ₹
                            {((selectedCreditPlan?.amount || 0) / 100).toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ₹
                            {(
                              ((selectedCreditPlan?.amount || 0) / 100) /
                              (selectedCreditPlan?.credits || 1)
                            ).toFixed(2)}{' '}
                            per credit
                          </div>
                        </div>
                      </div>

                      {/* Slider */}
                      <div className="space-y-3">
                        <Slider
                          value={[creditIndex]}
                          min={0}
                          max={creditPlans.length - 1}
                          step={1}
                          onValueChange={([val]) => setCreditIndex(val)}
                          className="w-full"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground px-1 font-bold">
                          {creditPlans.map((plan, i) => (
                            <button
                              key={plan.planId}
                              onClick={() => setCreditIndex(i)}
                              className={cn(
                                'transition-colors',
                                i === creditIndex ? 'text-foreground' : 'hover:text-foreground/70',
                              )}
                            >
                              {plan.credits >= 1000 ? `${plan.credits / 1000}k` : plan.credits}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Features */}
                      {selectedCreditPlan?.features && selectedCreditPlan.features.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedCreditPlan.features.map((feature) => (
                            <div key={feature} className="flex items-center gap-2 text-sm">
                              <Check className="h-3.5 w-3.5 text-[#d9ff00] shrink-0" />
                              <span className="text-muted-foreground text-xs">{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Purchase button */}
                      <Button
                        onClick={() => selectedCreditPlan && handlePayment(selectedCreditPlan)}
                        disabled={!paymentsEnabled || loadingPlan === selectedCreditPlan?.id}
                        className="w-full h-12 text-sm font-bold bg-[#d9ff00] text-black hover:bg-[#c0e600]"
                      >
                        {loadingPlan === selectedCreditPlan?.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : !paymentsEnabled ? (
                          t('pricing.buttons.disabled')
                        ) : (
                          <>
                            Buy {selectedCreditPlan?.credits.toLocaleString()} Credits for ₹
                            {((selectedCreditPlan?.amount || 0) / 100).toLocaleString('en-IN')}
                          </>
                        )}
                      </Button>

                      <p className="text-[10px] text-center text-muted-foreground">
                        Secured by Razorpay · Credits never expire
                      </p>
                    </div>

                    {/* Enterprise CTA */}
                    <div className="rounded-xl border-2 border-rose-500/30 bg-rose-500/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-full bg-rose-500/10 shrink-0">
                          <Crown className="h-5 w-5 text-rose-500" />
                        </div>
                        <div>
                          <div className="font-bold text-sm mb-0.5">Enterprise Plan</div>
                          <p className="text-xs text-muted-foreground">
                            Unlimited credits, dedicated support & custom integrations
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center sm:items-end gap-1.5 shrink-0">
                        <div className="text-xl font-bold">Custom Pricing</div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 text-xs"
                          onClick={() =>
                            window.open(
                              'mailto:enterprise@fairarena.app?subject=Enterprise Plan Inquiry',
                              '_blank',
                            )
                          }
                        >
                          Contact Us <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="text-center mt-6 text-sm text-muted-foreground">
            <p>
              {t('pricing.help.text')}{' '}
              <a href="mailto:support@fairarena.app" className="text-[#d9ff00] hover:underline">
                {t('pricing.help.link')}
              </a>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        paymentData={successPaymentData}
      />

      <PaymentFailureModal
        isOpen={showFailureModal}
        onClose={() => setShowFailureModal(false)}
        onRetry={() => {
          if (currentPlan && 'credits' in currentPlan) {
            handlePayment(currentPlan as PaymentPlan);
          }
        }}
        errorData={failurePaymentData}
      />
    </>
  );
}
