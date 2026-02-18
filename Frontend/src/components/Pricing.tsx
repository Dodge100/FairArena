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
import { useTheme } from '../hooks/useTheme';
import { useAuthState } from '../lib/auth';
import type { PaymentPlan, SubscriptionPlan } from '../services/paymentService';
import { paymentService } from '../services/paymentService';
import PaymentFailureModal from './PaymentFailureModal';
import PaymentSuccessModal from './PaymentSuccessModal';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader } from './ui/card';
import { Slider } from './ui/slider';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

interface SuccessPaymentData {
  planName: string;
  credits: number;
  amount: number;
  currency: string;
  orderId: string;
  paymentId: string;
  awaitingWebhook?: boolean;
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
  modal?: {
    ondismiss?: () => void;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
}

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

const Pricing = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isSignedIn, getToken } = useAuthState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Credit pack plans (one-time)
  const [creditPlans, setCreditPlans] = useState<PaymentPlan[]>([]);
  // Subscription plans
  const [subPlans, setSubPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPaymentData, setSuccessPaymentData] = useState<SuccessPaymentData | null>(null);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failurePaymentData, setFailurePaymentData] = useState<FailurePaymentData | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PaymentPlan | null>(null);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(2);
  const [activeTab, setActiveTab] = useState<'credits' | 'subscriptions'>('credits');
  const [subBillingCycle, setSubBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === 'true';

  // Fetch pricing plans from API
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const [fetchedCreditPlans, fetchedSubPlans] = await Promise.all([
          paymentService.getAllPlans(),
          paymentService.fetchSubscriptionPlans(),
        ]);
        // Filter out enterprise (amount=0) from credit slider
        setCreditPlans(fetchedCreditPlans.filter((p) => p.isActive && p.amount > 0));
        setSubPlans(fetchedSubPlans);
      } catch (error) {
        console.error('Failed to fetch plans:', error);
        toast.error('Failed to load pricing plans');
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  // Load Razorpay script
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

  const selectedCreditPlan = creditPlans[Math.min(selectedPlanIndex, creditPlans.length - 1)];

  const handlePayment = async (plan: PaymentPlan) => {
    if (!paymentsEnabled) {
      toast.error(t('pricing.disabled'));
      return;
    }

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    if (!razorpayLoaded) {
      toast.error('Payment system is loading. Please try again.');
      return;
    }

    if (plan.amount === 0) {
      window.open('mailto:support@fairarena.app?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    setLoadingPlan(plan.id);
    setCurrentPlan(plan);

    try {
      const token = await getToken();
      if (!isSignedIn || !token) {
        navigate('/signin');
        return;
      }

      const orderResponse = await paymentService.createOrder(plan.planId, token);

      if (!orderResponse.success || !orderResponse.order) {
        throw new Error(orderResponse.message || 'Failed to create order');
      }

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

              const pollInterval = setInterval(() => {
                queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
                queryClient.invalidateQueries({ queryKey: ['credits-history'] });
              }, 2000);

              setTimeout(() => clearInterval(pollInterval), 30000);

              setSuccessPaymentData({
                planName: verifyResult.data.planName,
                credits: verifyResult.data.credits,
                amount: verifyResult.data.amount,
                currency: verifyResult.data.currency,
                orderId: verifyResult.data.orderId,
                paymentId: verifyResult.data.paymentId,
                awaitingWebhook: verifyResult.awaitingWebhook || false,
              });
              setShowSuccessModal(true);
            } else {
              setFailurePaymentData({
                planName: plan.name,
                amount: plan.amount,
                currency: plan.currency,
                orderId: response.razorpay_order_id,
                errorMessage:
                  verifyResult.message || 'Payment verification failed. Please contact support.',
              });
              setShowFailureModal(true);
            }
          } catch (error: unknown) {
            console.error('Payment verification failed:', error);
            let errorMessage =
              'Payment verification failed. Please contact support if amount was deducted.';
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
        theme: {
          color: '#d9ff00',
        },
      };

      const rzp = new RazorpayConstructor(options);
      rzp.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setLoadingPlan(null);
    }
  };

  // Filtered subscription plans by billing cycle (Enterprise always shown)
  const filteredSubPlans = subPlans.filter(
    (p) => p.billingCycle === subBillingCycle || p.tier === 'ENTERPRISE',
  );

  return (
    <section
      id="pricing"
      className="w-full py-20 flex flex-col items-center justify-start bg-background relative overflow-hidden"
    >
      <div className="container mx-auto px-4 relative z-10">
        {/* Heading */}
        <div className="flex flex-col items-center mb-12">
          <h2
            className={cn(
              'text-sm md:text-lg font-semibold px-6 py-1 h-12 rounded-full flex items-center mb-6 border',
              isDark
                ? 'bg-neutral-900 text-[#d9ff00] border-neutral-800'
                : 'bg-neutral-100 text-neutral-800 border-neutral-200',
            )}
          >
            {t('pricing.title')}
          </h2>
          <h3
            className={cn(
              'text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center mb-6',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            {t('pricing.subtitle')}
          </h3>
          {!paymentsEnabled && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg max-w-lg">
              <p className="text-yellow-600 dark:text-yellow-400 text-center font-medium">
                {t('pricing.disabled')}
              </p>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-10">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'credits' | 'subscriptions')}
          >
            <TabsList className="h-11 px-1">
              <TabsTrigger value="credits" className="px-6 text-sm font-medium">
                Credit Packs
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="px-6 text-sm font-medium">
                Subscription Plans
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loadingPlans ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#d9ff00]" />
          </div>
        ) : (
          <>
            {/* ── Credit Packs Tab ── */}
            {activeTab === 'credits' && (
              <div className="max-w-3xl mx-auto space-y-8">
                {creditPlans.length === 0 ? (
                  <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed">
                    <p className="text-muted-foreground text-lg">{t('pricing.empty')}</p>
                  </div>
                ) : (
                  <>
                    {/* Slider Card */}
                    <Card className="border shadow-sm overflow-hidden">
                      <CardContent className="p-6 sm:p-10 space-y-8">
                        {/* Selected Plan Display */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-5xl font-bold tracking-tight">
                                {selectedCreditPlan?.credits.toLocaleString()}
                              </span>
                              <span className="text-xl text-muted-foreground font-medium">
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
                            <div className="text-sm text-muted-foreground">
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
                            min={0}
                            max={creditPlans.length - 1}
                            step={1}
                            value={[selectedPlanIndex]}
                            onValueChange={([val]) => setSelectedPlanIndex(val)}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground px-1">
                            {creditPlans.map((plan, i) => (
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
                        {selectedCreditPlan?.features && selectedCreditPlan.features.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedCreditPlan.features.map((feature) => (
                              <div key={feature} className="flex items-center gap-2 text-sm">
                                <Check className="h-4 w-4 text-[#d9ff00] shrink-0" />
                                <span className="text-muted-foreground">{feature}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Purchase Button */}
                        <Button
                          onClick={() => selectedCreditPlan && handlePayment(selectedCreditPlan)}
                          disabled={!paymentsEnabled || loadingPlan === selectedCreditPlan?.id}
                          className={cn(
                            'w-full h-14 text-base font-bold rounded-xl transition-all',
                            'bg-[#d9ff00] text-black hover:bg-[#c0e600] shadow-[0_10px_20px_rgba(217,255,0,0.2)]',
                          )}
                          size="lg"
                        >
                          {loadingPlan === selectedCreditPlan?.id ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Processing...
                            </>
                          ) : !paymentsEnabled ? (
                            t('pricing.buttons.disabled')
                          ) : (
                            <>
                              Buy {selectedCreditPlan?.credits.toLocaleString()} Credits for ₹
                              {((selectedCreditPlan?.amount || 0) / 100).toLocaleString('en-IN')}
                            </>
                          )}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                          Secured by Razorpay · Credits never expire
                        </p>
                      </CardContent>
                    </Card>

                    {/* Enterprise CTA */}
                    <Card
                      className={cn(
                        'border-2 transition-all duration-300',
                        isDark
                          ? 'border-neutral-700 bg-neutral-900/50'
                          : 'border-neutral-200 bg-neutral-50',
                      )}
                    >
                      <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-full bg-rose-500/10">
                            <Crown className="h-6 w-6 text-rose-500" />
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">Enterprise Plan</h4>
                            <p className="text-muted-foreground text-sm mt-0.5">
                              Unlimited credits, dedicated support & custom integrations
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
                                'mailto:enterprise@fairarena.app?subject=Enterprise Plan Inquiry',
                                '_blank',
                              )
                            }
                          >
                            Contact Us <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* ── Subscription Plans Tab ── */}
            {activeTab === 'subscriptions' && (
              <div className="space-y-8">
                {/* Billing cycle toggle */}
                <div className="flex justify-center">
                  <Tabs
                    value={subBillingCycle}
                    onValueChange={(v) => setSubBillingCycle(v as 'MONTHLY' | 'YEARLY')}
                  >
                    <TabsList className="h-10">
                      <TabsTrigger value="MONTHLY" className="px-6">
                        Monthly
                      </TabsTrigger>
                      <TabsTrigger value="YEARLY" className="px-6">
                        Yearly
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                          Save 20%
                        </Badge>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {subPlans.length === 0 ? (
                  <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed">
                    <p className="text-muted-foreground text-lg">{t('pricing.empty')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                    {filteredSubPlans.map((plan) => {
                      const isEnterprise = plan.tier === 'ENTERPRISE';
                      const displayMonthlyPrice =
                        plan.billingCycle === 'YEARLY'
                          ? Math.round(plan.amount / 12 / 100)
                          : Math.round(plan.amount / 100);

                      return (
                        <Card
                          key={plan.planId}
                          className={cn(
                            'relative flex flex-col border-2 transition-all duration-300 hover:scale-[1.02]',
                            plan.isPopular
                              ? 'border-[#d9ff00] shadow-[0_0_30px_rgba(217,255,0,0.15)]'
                              : 'border-border shadow-md',
                          )}
                        >
                          {plan.isPopular && (
                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                              <span className="bg-[#d9ff00] text-black px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider">
                                Most Popular
                              </span>
                            </div>
                          )}

                          <CardHeader className="pt-8 pb-4">
                            <div
                              className={cn(
                                'flex items-center gap-2 mb-3',
                                TIER_COLORS[plan.tier],
                              )}
                            >
                              {TIER_ICONS[plan.tier]}
                              <span className="font-semibold text-sm uppercase tracking-wider">
                                {plan.name}
                              </span>
                            </div>

                            {isEnterprise ? (
                              <div>
                                <div className="text-3xl font-bold">Custom</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  Contact us for pricing
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-bold">
                                    ₹{displayMonthlyPrice.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-muted-foreground text-sm">/mo</span>
                                </div>
                                {plan.billingCycle === 'YEARLY' && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    ₹{Math.round(plan.amount / 100).toLocaleString('en-IN')} billed
                                    yearly
                                  </div>
                                )}
                              </div>
                            )}

                            <CardDescription className="mt-2 text-sm leading-relaxed">
                              {plan.description}
                            </CardDescription>
                          </CardHeader>

                          <CardContent className="flex-1 flex flex-col justify-between pb-8">
                            <ul className="space-y-2.5 mb-8">
                              {plan.features.map((feature, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm">
                                  {feature.startsWith('Unlimited') ? (
                                    <InfinityIcon className="h-4 w-4 text-[#d9ff00] shrink-0 mt-0.5" />
                                  ) : (
                                    <Check className="h-4 w-4 text-[#d9ff00] shrink-0 mt-0.5" />
                                  )}
                                  <span className="text-foreground/80 leading-snug">{feature}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="mt-auto">
                              {isEnterprise ? (
                                <Button
                                  className="w-full"
                                  variant="outline"
                                  onClick={() =>
                                    window.open(
                                      'mailto:enterprise@fairarena.app?subject=Enterprise Plan Inquiry',
                                      '_blank',
                                    )
                                  }
                                >
                                  Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => navigate('/dashboard/subscription')}
                                  className={cn(
                                    'w-full h-12 font-bold rounded-xl transition-all',
                                    plan.isPopular
                                      ? 'bg-[#d9ff00] text-black hover:bg-[#c0e600] shadow-[0_10px_20px_rgba(217,255,0,0.2)]'
                                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                                  )}
                                >
                                  Get {plan.name} <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer Help */}
        <div className="text-center mt-16 p-8 rounded-3xl bg-muted/10 border border-border inline-block mx-auto">
          <p className="text-base text-muted-foreground">
            {t('pricing.help.text')}{' '}
            <a
              href="mailto:support@fairarena.app"
              className="text-[#d9ff00] font-bold hover:underline"
            >
              {t('pricing.help.link')}
            </a>
          </p>
        </div>
      </div>

      {/* Background elements */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-[#d9ff00]/5 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#d9ff00]/5 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />

      {/* Modals */}
      <PaymentSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        paymentData={successPaymentData}
      />

      <PaymentFailureModal
        isOpen={showFailureModal}
        onClose={() => setShowFailureModal(false)}
        onRetry={() => {
          if (currentPlan) {
            handlePayment(currentPlan);
          }
        }}
        errorData={failurePaymentData}
      />
    </section>
  );
};

export default Pricing;
