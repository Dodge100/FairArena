import { useAuth } from '@clerk/clerk-react';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import type { PaymentPlan } from '../services/paymentService';
import { paymentService } from '../services/paymentService';
import PaymentFailureModal from './PaymentFailureModal';
import PaymentSuccessModal from './PaymentSuccessModal';

declare global {
    interface Window {
        Razorpay: unknown;
    }
}

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

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
    const { getToken } = useAuth();
    const [plans, setPlans] = useState<PaymentPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [razorpayLoaded, setRazorpayLoaded] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successPaymentData, setSuccessPaymentData] = useState<SuccessPaymentData | null>(null);
    const [showFailureModal, setShowFailureModal] = useState(false);
    const [failurePaymentData, setFailurePaymentData] = useState<FailurePaymentData | null>(null);
    const [currentPlan, setCurrentPlan] = useState<PaymentPlan | null>(null);

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

        if (isOpen) {
            fetchPlans();
        }
    }, [isOpen]);

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
        if (!razorpayLoaded) {
            toast.error('Payment system is loading. Please try again.');
            return;
        }

        if (plan.amount === 0) {
            // Custom pricing - redirect to contact
            window.open('mailto:fairarena.contact@gmail.com?subject=Enterprise Plan Inquiry', '_blank');
            return;
        }

        setLoadingPlan(plan.id);
        setCurrentPlan(plan);

        try {
            const token = await getToken();
            if (!token) {
                toast.error('Please sign in to make a payment');
                return;
            }

            // Create order
            const orderResponse = await paymentService.createOrder(plan.planId, token);

            if (!orderResponse.success || !orderResponse.order) {
                throw new Error(orderResponse.message || 'Failed to create order');
            }

            // Close the pricing modal before opening Razorpay
            onClose();

            // Small delay to ensure modal closes properly
            setTimeout(() => {
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

                // Define Razorpay type if not available
                interface RazorpayOptions {
                    key: string;
                    amount: number;
                    currency: string;
                    name: string;
                    description?: string;
                    order_id: string;
                    handler?: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
                    modal?: {
                        ondismiss?: () => void;
                    };
                    prefill?: {
                        name?: string;
                        email?: string;
                        contact?: string;
                    };
                    notes?: Record<string, string>;
                    theme?: {
                        color?: string;
                    };
                }
                type RazorpayType = new (options: RazorpayOptions) => { open: () => void };
                const RazorpayConstructor = window.Razorpay as unknown as RazorpayType;

                const options: RazorpayOptions = {
                    key: order!.key,
                    amount: order!.amount,
                    currency: order!.currency,
                    order_id: order!.id,
                    name: 'FairArena',
                    description: `Payment for ${plan.name}`,
                    handler: async (response) => {
                        try {
                            // Get a fresh token for verification
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
                                // Show success modal with payment details
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
                            // User cancelled payment
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
            }, 100);
        } catch (error) {
            console.error('Payment error:', error);
            toast.error(error instanceof Error ? error.message : 'Payment failed');
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto z-50">
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl font-bold text-[#d9ff00]">
                            Choose Your Plan
                        </DialogTitle>
                        <p className="text-center text-muted-foreground">
                            Select the perfect plan for your hackathon needs
                        </p>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        {loadingPlans ? (
                            <div className="col-span-3 flex justify-center items-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-[#d9ff00]" />
                            </div>
                        ) : plans.length === 0 ? (
                            <div className="col-span-3 text-center py-12">
                                <p className="text-muted-foreground">No pricing plans available at the moment.</p>
                            </div>
                        ) : (
                            plans.map((plan) => (
                                <Card
                                    key={plan.id}
                                    className={`relative transition-all duration-200 hover:shadow-lg ${plan.planId === 'business_plan' ? 'border-[#d9ff00] border-2' : ''
                                        }`}
                                >
                                    {plan.planId === 'business_plan' && (
                                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                            <span className="bg-[#d9ff00] text-black px-3 py-1 rounded-full text-sm font-semibold">
                                                Most Popular
                                            </span>
                                        </div>
                                    )}

                                    <CardHeader className="text-center">
                                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                                        <CardDescription>{plan.description}</CardDescription>
                                        <div className="mt-4">
                                            {plan.amount === 0 ? (
                                                <div className="text-3xl font-bold">Custom</div>
                                            ) : (
                                                <>
                                                    <div className="text-3xl font-bold">₹{plan.amount / 100}</div>
                                                    <div className="text-sm text-muted-foreground">one-time payment</div>
                                                </>
                                            )}
                                        </div>
                                    </CardHeader>

                                    <CardContent>
                                        <ul className="space-y-2 mb-6">
                                            {plan.features.map((feature, index) => (
                                                <li key={index} className="flex items-center gap-2 text-sm">
                                                    <Check className="h-4 w-4 text-[#d9ff00] shrink-0" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>

                                        <Button
                                            onClick={() => handlePayment(plan)}
                                            disabled={loadingPlan === plan.id}
                                            className={`w-full ${plan.planId === 'business_plan'
                                                ? 'bg-[#d9ff00] text-black hover:bg-[#c0e600]'
                                                : ''
                                                }`}
                                            variant={plan.planId === 'business_plan' ? 'default' : 'outline'}
                                        >
                                            {loadingPlan === plan.id ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : plan.amount === 0 ? (
                                                'Contact Sales'
                                            ) : (
                                                'Purchase Now'
                                            )}
                                        </Button>

                                        {plan.credits > 0 && (
                                            <p className="text-xs text-center text-muted-foreground mt-2">
                                                Includes {plan.credits} hackathon credits
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    <div className="text-center mt-6 text-sm text-muted-foreground">
                        <p>Need help choosing? <a href="mailto:fairarena.contact@gmail.com" className="text-[#d9ff00] hover:underline">Contact our team</a></p>
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
                    if (currentPlan) {
                        handlePayment(currentPlan);
                    }
                }}
                errorData={failurePaymentData}
            />
        </>
    );
}
