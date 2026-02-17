import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '../hooks/useTheme';
import { useAuthState } from '../lib/auth';
import type { PaymentPlan } from '../services/paymentService';
import { paymentService } from '../services/paymentService';
import PaymentFailureModal from './PaymentFailureModal';
import PaymentSuccessModal from './PaymentSuccessModal';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

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
    modal?: {
        ondismiss?: () => void;
    };
    notes?: Record<string, string>;
    theme?: {
        color?: string;
    };
}

const Pricing = () => {
    const { t } = useTranslation();
    const { isDark } = useTheme();
    const { isSignedIn, getToken } = useAuthState();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [plans, setPlans] = useState<PaymentPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [razorpayLoaded, setRazorpayLoaded] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successPaymentData, setSuccessPaymentData] = useState<SuccessPaymentData | null>(null);
    const [showFailureModal, setShowFailureModal] = useState(false);
    const [failurePaymentData, setFailurePaymentData] = useState<FailurePaymentData | null>(null);
    const [currentPlan, setCurrentPlan] = useState<PaymentPlan | null>(null);

    const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === 'true';

    // Fetch pricing plans from API
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                setLoadingPlans(true);
                const fetchedPlans = await paymentService.getAllPlans();
                setPlans(fetchedPlans);
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
            // Custom pricing - redirect to contact
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

            // Create order
            const orderResponse = await paymentService.createOrder(plan.planId, token);

            if (!orderResponse.success || !orderResponse.order) {
                throw new Error(orderResponse.message || 'Failed to create order');
            }

            const { order } = orderResponse;

            // Validate that the server amount matches the expected plan amount
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

                            // Delayed invalidation to handle async backend processing
                            setTimeout(() => {
                                queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
                                queryClient.invalidateQueries({ queryKey: ['credits-history'] });
                            }, 2000);

                            setTimeout(() => {
                                queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
                                queryClient.invalidateQueries({ queryKey: ['credits-history'] });
                            }, 5000);

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
                                errorMessage: verifyResult.message || 'Payment verification failed. Please contact support.',
                            });
                            setShowFailureModal(true);
                        }
                    } catch (error: unknown) {
                        console.error('Payment verification failed:', error);
                        let errorMessage = 'Payment verification failed. Please contact support if amount was deducted.';
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

    return (
        <section id="pricing" className="w-full py-20 flex flex-col items-center justify-start bg-background relative overflow-hidden">
            <div className="container mx-auto px-4 relative z-10">
                {/* Heading */}
                <div className="flex flex-col items-center mb-16">
                    <h2
                        className={cn(
                            "text-sm md:text-lg font-semibold px-6 py-1 h-12 rounded-full flex items-center mb-6 border",
                            isDark ? "bg-neutral-900 text-[#d9ff00] border-neutral-800" : "bg-neutral-100 text-neutral-800 border-neutral-200"
                        )}
                    >
                        {t('pricing.title')}
                    </h2>
                    <h3 className={cn(
                        "text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center mb-6",
                        isDark ? "text-white" : "text-gray-900"
                    )}>
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

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {loadingPlans ? (
                        <div className="col-span-full flex justify-center items-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-[#d9ff00]" />
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="col-span-full text-center py-20 bg-muted/30 rounded-3xl border border-dashed">
                            <p className="text-muted-foreground text-lg">{t('pricing.empty')}</p>
                        </div>
                    ) : (
                        plans.map((plan) => (
                            <Card
                                key={plan.id}
                                className={cn(
                                    "relative flex flex-col h-full border-2 transition-all duration-300 hover:scale-[1.02] bg-card/50 backdrop-blur-sm",
                                    plan.planId === 'business_plan'
                                        ? "border-[#d9ff00] shadow-[0_0_30px_rgba(217,255,0,0.15)] md:-translate-y-4"
                                        : "border-border shadow-md"
                                )}
                            >
                                {plan.planId === 'business_plan' && (
                                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                                        <span className="bg-[#d9ff00] text-black px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider">
                                            {t('pricing.popular')}
                                        </span>
                                    </div>
                                )}

                                <CardHeader className="text-center pt-10 pb-6">
                                    <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                                    <CardDescription className="text-base">{plan.description}</CardDescription>
                                    <div className="mt-8 flex flex-col items-center">
                                        {plan.amount === 0 ? (
                                            <div className="text-4xl font-bold">{t('pricing.custom')}</div>
                                        ) : (
                                            <>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-bold">₹</span>
                                                    <span className="text-5xl font-extrabold">{plan.amount / 100}</span>
                                                </div>
                                                <div className="text-sm font-medium text-muted-foreground mt-2">{t('pricing.oneTime')}</div>
                                            </>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="flex-1 flex flex-col justify-between pb-10">
                                    <ul className="space-y-4 mb-10">
                                        {plan.features.map((feature, index) => (
                                            <li key={index} className="flex items-start gap-3 text-sm lg:text-base">
                                                <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-[#d9ff00]/20 flex items-center justify-center">
                                                    <Check className="h-3.5 w-3.5 text-[#d9ff00]" />
                                                </div>
                                                <span className="text-foreground/90">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="mt-auto space-y-4">
                                        <Button
                                            onClick={() => handlePayment(plan)}
                                            disabled={!paymentsEnabled || loadingPlan === plan.id}
                                            className={cn(
                                                "w-full h-14 text-lg font-bold rounded-xl transition-all",
                                                plan.planId === 'business_plan'
                                                    ? 'bg-[#d9ff00] text-black hover:bg-[#c0e600] shadow-[0_10px_20px_rgba(217,255,0,0.2)]'
                                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            )}
                                        >
                                            {loadingPlan === plan.id ? (
                                                <span className="flex items-center gap-2">
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    {t('pricing.buttons.processing')}
                                                </span>
                                            ) : !paymentsEnabled ? (
                                                t('pricing.buttons.disabled')
                                            ) : plan.amount === 0 ? (
                                                t('pricing.buttons.contactSales')
                                            ) : (
                                                t('pricing.buttons.purchase')
                                            )}
                                        </Button>

                                        {plan.credits > 0 && (
                                            <p className="text-xs text-center font-medium text-muted-foreground">
                                                {t('pricing.creditsInfo', { count: plan.credits })}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

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
