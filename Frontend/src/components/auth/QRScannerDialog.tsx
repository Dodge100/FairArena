import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/apiClient';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTheme } from '../../hooks/useTheme';
import { QRScanner } from './QRScanner';

interface QRScannerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface DeviceInfo {
    browser: string;
    os: string;
    device: string;
    location: string;
}

interface ApprovalRequest {
    sessionId: string;
    deviceInfo: DeviceInfo;
    expiresAt: number;
    createdAt: number;
}

export function QRScannerDialog({ open, onOpenChange }: QRScannerDialogProps) {
    const { isDark } = useTheme();

    const [step, setStep] = useState<'scan' | 'approve'>('scan');
    const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    // Countdown timer for approval
    useEffect(() => {
        if (step !== 'approve' || !approvalReq) return;

        const updateTimer = () => {
            const remaining = Math.max(0, Math.floor((approvalReq.expiresAt - Date.now()) / 1000));
            setTimeLeft(remaining);

            if (remaining <= 0) {
                toast.error('Session expired. Please scan again.');
                handleClose();
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [step, approvalReq]);

    // Handle successful QR scan
    const handleScan = async (dataString: string) => {
        try {
            let data;
            try {
                data = JSON.parse(dataString);
            } catch {
                // Silent ignore - not a valid JSON QR
                return;
            }

            if (data.type !== 'fairarena_qr_auth' || !data.sessionId) {
                toast.error('Invalid QR code. Please scan a FairArena login QR.');
                return;
            }

            // Check if already expired client-side
            if (data.expiresAt && Date.now() > data.expiresAt) {
                toast.error('This QR code has expired. Ask for a new one.');
                return;
            }

            setLoading(true);

            const response = await apiFetch('/api/v1/auth/qr/device-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: data.sessionId }),
            });

            const textHTML = await response.text();
            let resData;
            try {
                resData = textHTML ? JSON.parse(textHTML) : {};
            } catch (e) {
                console.error('Failed to parse device-info response:', textHTML);
                toast.error('Server returned an invalid response');
                return;
            }

            if (resData.success) {
                setApprovalReq({
                    sessionId: data.sessionId,
                    deviceInfo: resData.data.deviceInfo,
                    expiresAt: resData.data.expiresAt,
                    createdAt: resData.data.createdAt,
                });
                setStep('approve');
                setTimeLeft(Math.floor((resData.data.expiresAt - Date.now()) / 1000));
            } else {
                toast.error(resData.message || 'Could not verify QR code');
            }
        } catch (error: any) {
            console.error('Scan Error:', error);
            toast.error(error.message || 'Failed to process QR code');
        } finally {
            setLoading(false);
        }
    };

    // Handle approval
    const handleApprove = async () => {
        if (!approvalReq) return;

        try {
            setLoading(true);

            const response = await apiFetch('/api/v1/auth/qr/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: approvalReq.sessionId }),
            });

            const textHTML = await response.text();
            let data;
            try {
                data = textHTML ? JSON.parse(textHTML) : {};
            } catch (e) {
                console.error('Failed to parse approve response:', textHTML);
                toast.error('Server returned an invalid response');
                return;
            }

            if (data.success) {
                toast.success('Login approved! The other device is now signed in.');
                handleClose();
            } else {
                toast.error(data.message || 'Failed to approve login');
            }
        } catch (error: any) {
            console.error('Approve Error:', error);
            toast.error(error.message || 'Failed to approve login');
        } finally {
            setLoading(false);
        }
    };

    // Handle rejection
    const handleReject = () => {
        toast.info('Login request rejected');
        handleClose();
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset state after dialog animation
        setTimeout(() => {
            setStep('scan');
            setApprovalReq(null);
            setLoading(false);
            setTimeLeft(0);
        }, 200);
    };

    // Get device icon based on type
    const getDeviceIcon = () => {
        const device = approvalReq?.deviceInfo.device;
        if (device === 'Mobile') {
            return (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
            );
        }
        if (device === 'Tablet') {
            return (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z" />
                </svg>
            );
        }
        return (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className={`sm:max-w-[420px] p-0 overflow-hidden ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white'
                    }`}
            >
                {/* Header */}
                <DialogHeader className={`px-6 pt-6 pb-4 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'
                            }`}>
                            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <DialogTitle className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                                {step === 'scan' ? 'Scan QR Code' : 'Approve Login'}
                            </DialogTitle>
                            <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                {step === 'scan'
                                    ? 'Point camera at the login QR code'
                                    : 'Verify this is your sign-in request'
                                }
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6">
                    {step === 'scan' ? (
                        <div className="space-y-4">
                            <QRScanner
                                onScan={handleScan}
                                onError={(err) => console.log('Scanner:', err)}
                            />
                            {loading && (
                                <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    Verifying...
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Device Card */}
                            <div className={`p-5 rounded-2xl border ${isDark
                                ? 'bg-neutral-800/50 border-neutral-700'
                                : 'bg-neutral-50 border-neutral-200'
                                }`}>
                                <div className="flex items-start gap-4">
                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-neutral-700' : 'bg-white shadow-sm'
                                        }`}>
                                        {getDeviceIcon()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold text-base truncate ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                                            {approvalReq?.deviceInfo.browser} on {approvalReq?.deviceInfo.os}
                                        </h3>
                                        <p className={`text-sm mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                            {approvalReq?.deviceInfo.device} • {approvalReq?.deviceInfo.location || 'Unknown location'}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${timeLeft < 15
                                                ? 'bg-red-500/10 text-red-500'
                                                : isDark ? 'bg-neutral-700 text-neutral-300' : 'bg-neutral-200 text-neutral-600'
                                                }`}>
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {timeLeft}s left
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Security Warning */}
                            <div className={`p-4 rounded-xl border flex gap-3 ${isDark
                                ? 'bg-yellow-500/5 border-yellow-500/20'
                                : 'bg-yellow-50 border-yellow-200'
                                }`}>
                                <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <p className={`text-sm font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                                        Security check
                                    </p>
                                    <p className={`text-sm mt-0.5 ${isDark ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                                        Only approve if <strong>you</strong> initiated this sign-in request on the other device.
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleReject}
                                    disabled={loading}
                                    className={`py-3.5 px-4 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${isDark
                                        ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                                        : 'bg-white hover:bg-neutral-50 text-neutral-900 border border-neutral-200 shadow-sm'
                                        }`}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        Reject
                                    </span>
                                </button>
                                <button
                                    onClick={handleApprove}
                                    disabled={loading}
                                    className="py-3.5 px-4 rounded-xl font-bold bg-[#DDEF00] hover:bg-[#c7db00] text-black transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        {loading ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                                Approving...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                                Approve
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
