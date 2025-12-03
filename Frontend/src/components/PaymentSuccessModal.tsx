import { Check, Trophy, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent } from '../components/ui/dialog';

interface PaymentSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    paymentData: {
        planName: string;
        credits: number;
        amount: number;
        currency: string;
        orderId: string;
        paymentId: string;
    } | null;
}

export default function PaymentSuccessModal({ isOpen, onClose, paymentData }: PaymentSuccessModalProps) {
    const [showConfetti, setShowConfetti] = useState(false);
    const [showContent, setShowContent] = useState(false);
    const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        // Get window dimensions for confetti
        const updateDimensions = () => {
            setWindowDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        let confettiTimeout: ReturnType<typeof setTimeout> | null = null;
        let contentTimeout: ReturnType<typeof setTimeout> | null = null;

        if (isOpen) {
            confettiTimeout = setTimeout(() => setShowConfetti(true), 200);
            contentTimeout = setTimeout(() => setShowContent(true), 600);
        }

        return () => {
            if (confettiTimeout) clearTimeout(confettiTimeout);
            if (contentTimeout) clearTimeout(contentTimeout);
            setShowConfetti(false);
            setShowContent(false);
        };
    }, [isOpen]);

    if (!paymentData) return null;

    return (
        <>
            {/* Confetti Animation */}
            {showConfetti && (
                <Confetti
                    width={windowDimensions.width}
                    height={windowDimensions.height}
                    recycle={false}
                    numberOfPieces={200}
                    gravity={0.1}
                    colors={['#d9ff00', '#c0e600', '#ffff00', '#ffd700', '#ffed4e']}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        zIndex: 9999,
                        pointerEvents: 'none',
                    }}
                />
            )}

            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-md mx-auto bg-linear-to-br from-gray-900 via-gray-800 to-black border border-[#d9ff00]/20 shadow-2xl">
                    {/* Main content */}
                    <div className={`relative z-10 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        {/* Success icon with animation */}
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#d9ff00] rounded-full animate-ping opacity-20"></div>
                                <div className="relative bg-[#d9ff00] rounded-full p-4 shadow-lg shadow-[#d9ff00]/30">
                                    <Check className="h-8 w-8 text-black" />
                                </div>
                            </div>
                        </div>

                        {/* Success message */}
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">
                                Payment Successful! 🎉
                            </h2>
                            <p className="text-gray-300 text-sm">
                                Your payment has been processed successfully
                            </p>
                        </div>

                        {/* Payment details card */}
                        <div className="bg-gray-800/50 rounded-xl p-6 mb-6 border border-gray-700/50">
                            <div className="space-y-4">
                                {/* Plan info */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Trophy className="h-5 w-5 text-[#d9ff00]" />
                                        <span className="text-white font-medium">{paymentData.planName}</span>
                                    </div>
                                    <span className="text-[#d9ff00] font-bold">
                                        ₹{paymentData.amount / 100}
                                    </span>
                                </div>

                                {/* Credits awarded */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Zap className="h-5 w-5 text-[#d9ff00]" />
                                        <span className="text-white">Credits Awarded</span>
                                    </div>
                                    <span className="text-[#d9ff00] font-bold">
                                        +{paymentData.credits}
                                    </span>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-gray-700/50"></div>

                                {/* Transaction details */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Order ID:</span>
                                        <span className="text-gray-300 font-mono text-xs">
                                            {paymentData.orderId.slice(-8)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Payment ID:</span>
                                        <span className="text-gray-300 font-mono text-xs">
                                            {paymentData.paymentId.slice(-8)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Success message */}
                        <div className="bg-linear-to-r from-[#d9ff00]/10 to-[#d9ff00]/5 rounded-lg p-4 mb-6 border border-[#d9ff00]/20">
                            <p className="text-center text-sm text-gray-300">
                                <span className="text-[#d9ff00] font-semibold">{paymentData.credits} credits</span> have been added to your account.
                                You can now create and manage hackathons!
                            </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3">
                            <Button
                                onClick={onClose}
                                variant="outline"
                                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                            >
                                Continue
                            </Button>
                            <Button
                                onClick={() => {
                                    onClose();
                                    // Navigate to dashboard or credits page
                                    window.location.href = '/dashboard';
                                }}
                                className="flex-1 bg-[#d9ff00] text-black hover:bg-[#c0e600] font-semibold"
                            >
                                View Dashboard
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
