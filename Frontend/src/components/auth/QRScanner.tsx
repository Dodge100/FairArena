import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
    onScan: (data: string) => void;
    onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const regionId = 'qr-scanner-region';
    const [status, setStatus] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        let mounted = true;

        const startScanner = async () => {
            try {
                // Request camera permission
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' }
                    });
                    stream.getTracks().forEach(track => track.stop());
                    if (!mounted) return;
                    setStatus('ready');
                } catch {
                    if (!mounted) return;
                    setStatus('denied');
                    onError?.('Camera permission denied');
                    return;
                }

                // Initialize scanner
                if (!scannerRef.current) {
                    scannerRef.current = new Html5Qrcode(regionId, {
                        verbose: false,
                        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                    });
                }

                await scannerRef.current.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 220, height: 220 },
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        // Prevent double scans
                        if (scanned) return;
                        setScanned(true);

                        // Haptic feedback on supported devices
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }

                        onScan(decodedText);

                        // Stop scanner after success
                        if (scannerRef.current?.isScanning) {
                            scannerRef.current.stop().catch(console.error);
                        }
                    },
                    () => {
                        // Silent: frame decode errors are normal
                    }
                );
            } catch (err) {
                console.error('Scanner start failed:', err);
                if (mounted) {
                    setStatus('error');
                    const msg = err instanceof Error ? err.message : 'Failed to start camera';
                    onError?.(msg);
                }
            }
        };

        startScanner();

        return () => {
            mounted = false;
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(() => { });
            }
        };
    }, [onScan, onError, scanned]);

    return (
        <div ref={containerRef} className="w-full max-w-[300px] mx-auto">
            {/* Scanner Container */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
                {/* Video Region */}
                <div
                    id={regionId}
                    className="w-full h-full [&>video]:object-cover"
                />

                {/* Scanning Overlay - only show when ready */}
                {status === 'ready' && !scanned && (
                    <div className="absolute inset-0 pointer-events-none">
                        {/* Corner markers */}
                        <div className="absolute top-4 left-4 w-10 h-10 border-l-3 border-t-3 border-[#DDEF00] rounded-tl-lg" />
                        <div className="absolute top-4 right-4 w-10 h-10 border-r-3 border-t-3 border-[#DDEF00] rounded-tr-lg" />
                        <div className="absolute bottom-4 left-4 w-10 h-10 border-l-3 border-b-3 border-[#DDEF00] rounded-bl-lg" />
                        <div className="absolute bottom-4 right-4 w-10 h-10 border-r-3 border-b-3 border-[#DDEF00] rounded-br-lg" />

                        {/* Scanning line animation */}
                        <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#DDEF00] to-transparent animate-scan" />
                    </div>
                )}

                {/* Loading State */}
                {status === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                        <div className="text-center">
                            <svg className="w-8 h-8 mx-auto mb-3 text-[#DDEF00] animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <p className="text-sm text-neutral-400">Starting camera...</p>
                        </div>
                    </div>
                )}

                {/* Permission Denied State */}
                {status === 'denied' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 p-6">
                        <div className="text-center">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-white mb-1">Camera Access Denied</p>
                            <p className="text-xs text-neutral-400">
                                Enable camera permissions in your browser settings to scan QR codes.
                            </p>
                        </div>
                    </div>
                )}

                {/* Success State */}
                {scanned && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="text-center">
                            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
                                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-white">Scanned!</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Instructions */}
            <p className="text-center text-xs text-neutral-500 mt-4">
                Position the QR code within the frame to scan
            </p>
        </div>
    );
}
