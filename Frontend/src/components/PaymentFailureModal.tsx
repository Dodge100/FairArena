import { AlertCircle, Home, RefreshCcw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent } from '../components/ui/dialog';

interface PaymentFailureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRetry: () => void;
    errorData: {
        planName: string;
        amount: number;
        currency: string;
        orderId?: string;
        errorMessage: string;
    } | null;
}

export default function PaymentFailureModal({ isOpen, onClose, onRetry, errorData }: PaymentFailureModalProps) {
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isOpen) {
            timeoutId = setTimeout(() => setShowContent(true), 200);
        } else {
            timeoutId = setTimeout(() => setShowContent(false), 200);
        }
        return () => clearTimeout(timeoutId);
    }, [isOpen]);

    if (!errorData) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-linear-to-br from-gray-900 via-gray-850 to-gray-900 border border-red-500/30 shadow-2xl backdrop-blur-xl">
                {/* Animated background gradient */}
                <div className="absolute inset-0 bg-linear-to-br from-red-500/5 via-transparent to-blue-500/5 animate-pulse" />

                {/* Main content */}
                <div className={`relative z-10 transition-all duration-700 ease-out ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    {/* Error icon with enhanced animation */}
                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
                            <div className="absolute inset-0 bg-red-500/10 rounded-full blur-xl" />
                            <div className="relative bg-linear-to-br from-red-500 to-red-600 rounded-full p-5 shadow-2xl shadow-red-500/50 ring-4 ring-red-500/20">
                                <XCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>

                    {/* Error message */}
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
                            Payment Failed
                        </h2>
                        <p className="text-gray-400 text-base">
                            We couldn't process your payment. Please try again.
                        </p>
                    </div>

                    {/* Error details card */}
                    <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-700/60 shadow-xl">
                        <div className="space-y-4">
                            {/* Plan info */}
                            <div className="flex items-center justify-between py-1">
                                <span className="text-gray-400 text-sm font-medium">Plan</span>
                                <span className="text-white font-semibold text-base">{errorData.planName}</span>
                            </div>

                            {/* Amount */}
                            <div className="flex items-center justify-between py-1">
                                <span className="text-gray-400 text-sm font-medium">Amount</span>
                                <span className="text-white font-semibold text-lg">
                                    ₹{(errorData.amount / 100).toLocaleString('en-IN')}
                                </span>
                            </div>

                            {/* Order ID if available */}
                            {errorData.orderId && (
                                <div className="flex items-center justify-between py-1">
                                    <span className="text-gray-400 text-sm font-medium">Order ID</span>
                                    <span className="text-gray-300 font-mono text-xs bg-gray-700/50 px-3 py-1 rounded-md">
                                        {errorData.orderId.slice(-12)}
                                    </span>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-gray-700/70 my-4" />

                            {/* Error reason */}
                            <div className="bg-linear-to-br from-red-500/15 to-red-600/10 border border-red-500/30 rounded-xl p-4 shadow-lg">
                                <div className="flex items-start gap-3">
                                    <div className="bg-red-500/20 rounded-lg p-1.5 mt-0.5">
                                        <AlertCircle className="h-5 w-5 text-red-400" strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-red-300 font-semibold text-sm mb-1.5">
                                            Error Details
                                        </p>
                                        <p className="text-gray-300 text-sm leading-relaxed">
                                            {errorData.errorMessage}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Help message */}
                    <div className="bg-linear-to-r from-blue-500/10 via-blue-500/5 to-transparent rounded-xl p-4 mb-6 border border-blue-500/30 shadow-lg">
                        <p className="text-center text-sm text-gray-300 leading-relaxed">
                            <span className="text-blue-400 font-semibold">Need assistance?</span>
                            <br className="sm:hidden" />
                            <span className="hidden sm:inline"> </span>
                            Contact us at{' '}
                            <a
                                href="mailto:fairarena.contact@gmail.com"
                                className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 hover:decoration-blue-300 underline-offset-2 transition-colors font-medium"
                            >
                                fairarena.contact@gmail.com
                            </a>
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white hover:bg-gray-800/80 transition-all duration-200 h-11 font-medium"
                        >
                            <Home className="mr-2 h-4 w-4" />
                            Go Back
                        </Button>
                        <Button
                            onClick={() => {
                                onClose();
                                onRetry();
                            }}
                            className="flex-1 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all duration-200 h-11 font-semibold"
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Try Again
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
