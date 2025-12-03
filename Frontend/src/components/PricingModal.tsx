import { useAuth } from '@clerk/clerk-react';
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import type { PaymentPlan } from '../services/paymentService';
import { paymentService } from '../services/paymentService';

declare global {
    interface Window {
        Razorpay: unknown;
    }
}

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
    const { getToken } = useAuth();
    const [plans] = useState<PaymentPlan[]>(paymentService.getAllPlans());
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [razorpayLoaded, setRazorpayLoaded] = useState(false);

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

        try {
            const token = await getToken();
            if (!token) {
                toast.error('Please sign in to make a payment');
                return;
            }

            // Create order
            const orderResponse = await paymentService.createOrder(plan.id, token);

            if (!orderResponse.success || !orderResponse.order) {
                throw new Error(orderResponse.message || 'Failed to create order');
            }

            // Close the pricing modal before opening Razorpay
            onClose();

            // Small delay to ensure modal closes properly
            setTimeout(() => {
                // Define Razorpay type if not available
                interface RazorpayOptions {
                    key: string;
                    amount: number;
                    currency: string;
                    name: string;
                    description?: string;
                    order_id: string;
                    handler?: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
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
                // @ts-ignore
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
                    {plans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={`relative transition-all duration-200 hover:shadow-lg ${plan.id === 'business' ? 'border-[#d9ff00] border-2' : ''
                                }`}
                        >
                            {plan.id === 'business' && (
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
                                    className={`w-full ${plan.id === 'business'
                                            ? 'bg-[#d9ff00] text-black hover:bg-[#c0e600]'
                                            : ''
                                        }`}
                                    variant={plan.id === 'business' ? 'default' : 'outline'}
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
                    ))}
                </div>

                <div className="text-center mt-6 text-sm text-muted-foreground">
                    <p>Need help choosing? <a href="mailto:fairarena.contact@gmail.com" className="text-[#d9ff00] hover:underline">Contact our team</a></p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
