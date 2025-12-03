import { AlertCircle, Home, RefreshCcw, X } from 'lucide-react';
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
            <DialogContent className="max-w-md mx-auto bg-linear-to-br from-gray-900 via-gray-800 to-black border border-red-500/20 shadow-2xl">
                {/* Main content */}
                <div className={`relative z-10 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    {/* Error icon with animation */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse opacity-20"></div>
                            <div className="relative bg-red-500 rounded-full p-4 shadow-lg shadow-red-500/30">
                                <X className="h-8 w-8 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Error message */}
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Payment Failed
                        </h2>
                        <p className="text-gray-300 text-sm">
                            We couldn't process your payment
                        </p>
                    </div>

                    {/* Error details card */}
                    <div className="bg-gray-800/50 rounded-xl p-6 mb-6 border border-gray-700/50">
                        <div className="space-y-4">
                            {/* Plan info */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Plan:</span>
                                <span className="text-white font-medium">{errorData.planName}</span>
                            </div>

                            {/* Amount */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Amount:</span>
                                <span className="text-white font-medium">
                                    ₹{errorData.amount / 100}
                                </span>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-700/50"></div>

                            {/* Error reason */}
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-red-400 font-medium text-sm mb-1">
                                            Error Details
                                        </p>
                                        <p className="text-gray-300 text-sm">
                                            {errorData.errorMessage}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Order ID if available */}
                            {errorData.orderId && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Order ID:</span>
                                    <span className="text-gray-300 font-mono text-xs">
                                        {errorData.orderId.slice(-8)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Help message */}
                    <div className="bg-linear-to-r from-blue-500/10 to-blue-500/5 rounded-lg p-4 mb-6 border border-blue-500/20">
                        <p className="text-center text-sm text-gray-300">
                            <span className="text-blue-400 font-semibold">Need help?</span> Contact our support team at{' '}
                            <a href="mailto:fairarena.contact@gmail.com" className="text-blue-400 hover:underline">
                                fairarena.contact@gmail.com
                            </a>
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                        >
                            <Home className="mr-2 h-4 w-4" />
                            Go Back
                        </Button>
                        <Button
                            onClick={() => {
                                onClose();
                                onRetry();
                            }}
                            className="flex-1 bg-blue-600 text-white hover:bg-blue-700 font-semibold"
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
