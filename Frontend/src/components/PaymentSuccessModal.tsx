import { Check, Sparkles, Trophy, Zap } from 'lucide-react';
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
                    numberOfPieces={300}
                    gravity={0.15}
                    colors={['#d9ff00', '#c0e600', '#a8d400', '#ffd700', '#ffed4e', '#90ee90']}
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
                <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-linear-to-br from-gray-900 via-gray-850 to-gray-900 border border-[#d9ff00]/40 shadow-2xl backdrop-blur-xl">
                    {/* Animated background gradient */}
                    <div className="absolute inset-0 bg-linear-to-br from-[#d9ff00]/10 via-transparent to-green-500/5 animate-pulse" />

                    {/* Main content */}
                    <div className={`relative z-10 transition-all duration-700 ease-out ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        {/* Success icon with enhanced animation */}
                        <div className="flex justify-center mb-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#d9ff00]/30 rounded-full animate-ping" />
                                <div className="absolute inset-0 bg-[#d9ff00]/20 rounded-full blur-2xl" />
                                <div className="relative bg-linear-to-br from-[#d9ff00] to-[#c0e600] rounded-full p-6 shadow-2xl shadow-[#d9ff00]/60 ring-4 ring-[#d9ff00]/30">
                                    <Check className="h-12 w-12 text-black" strokeWidth={3} />
                                </div>
                                <div className="absolute -top-1 -right-1">
                                    <Sparkles className="h-6 w-6 text-[#d9ff00] animate-pulse" />
                                </div>
                            </div>
                        </div>

                        {/* Success message */}
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
                                Payment Successful! 🎉
                            </h2>
                            <p className="text-gray-400 text-base">
                                Your payment has been processed successfully
                            </p>
                        </div>

                        {/* Payment details card */}
                        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-700/60 shadow-xl">
                            <div className="space-y-5">
                                {/* Plan info */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-[#d9ff00]/20 rounded-lg p-2">
                                            <Trophy className="h-5 w-5 text-[#d9ff00]" strokeWidth={2.5} />
                                        </div>
                                        <span className="text-white font-semibold text-base">{paymentData.planName}</span>
                                    </div>
                                    <span className="text-[#d9ff00] font-bold text-xl">
                                        ₹{(paymentData.amount / 100).toLocaleString('en-IN')}
                                    </span>
                                </div>

                                {/* Credits awarded - Highlighted */}
                                <div className="bg-linear-to-r from-[#d9ff00]/20 to-[#d9ff00]/10 rounded-xl p-4 border border-[#d9ff00]/30 shadow-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-[#d9ff00]/30 rounded-lg p-2">
                                                <Zap className="h-6 w-6 text-[#d9ff00]" strokeWidth={2.5} fill="currentColor" />
                                            </div>
                                            <span className="text-white font-semibold text-base">Credits Awarded</span>
                                        </div>
                                        <span className="text-[#d9ff00] font-bold text-2xl">
                                            +{paymentData.credits.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-gray-700/70 my-4" />

                                {/* Transaction details */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400 text-sm font-medium">Order ID</span>
                                        <span className="text-gray-300 font-mono text-xs bg-gray-700/50 px-3 py-1.5 rounded-md">
                                            {paymentData.orderId.slice(-12)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400 text-sm font-medium">Payment ID</span>
                                        <span className="text-gray-300 font-mono text-xs bg-gray-700/50 px-3 py-1.5 rounded-md">
                                            {paymentData.paymentId.slice(-12)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Success message */}
                        <div className="bg-linear-to-r from-[#d9ff00]/15 via-[#d9ff00]/10 to-transparent rounded-xl p-4 mb-6 border border-[#d9ff00]/30 shadow-lg">
                            <p className="text-center text-sm text-gray-300 leading-relaxed">
                                <span className="text-[#d9ff00] font-bold text-base">{paymentData.credits.toLocaleString()} credits</span> have been added to your account.
                                <br />
                                <span className="text-gray-400">You can now create and manage hackathons!</span>
                            </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3">
                            <Button
                                onClick={onClose}
                                variant="outline"
                                className="flex-1 border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white hover:bg-gray-800/80 transition-all duration-200 h-11 font-medium"
                            >
                                Continue
                            </Button>
                            <Button
                                onClick={() => {
                                    onClose();
                                    window.location.href = '/dashboard';
                                }}
                                className="flex-1 bg-linear-to-r from-[#d9ff00] to-[#c0e600] hover:from-[#c0e600] hover:to-[#a8d400] text-black shadow-lg shadow-[#d9ff00]/40 hover:shadow-[#d9ff00]/60 transition-all duration-200 h-11 font-bold"
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
