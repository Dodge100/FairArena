import { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function VerifyEmail() {
    const { isDark } = useTheme();
    const { token } = useParams<{ token: string }>();
    const { verifyEmail, resendVerificationEmail } = useAuth(); // Updated to include resendVerificationEmail

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    // Resend state
    const [resendEmail, setResendEmail] = useState('');
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [resendMessage, setResendMessage] = useState('');
    const recaptchaRef = useRef<ReCAPTCHA>(null);

    const [showCaptchaModal, setShowCaptchaModal] = useState(false);

    const initiateResend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!resendEmail) return;
        setShowCaptchaModal(true);
    };

    const handleCaptchaChange = async (token: string | null) => {
        if (!token) return;

        setResendStatus('sending');
        try {
            await resendVerificationEmail(resendEmail, token);
            setResendStatus('success');
            setResendMessage('Verification link sent! Please check your email.');
            setShowCaptchaModal(false);
            // Reset happens automatically on unmount or we can force it if using same ref
            setTimeout(() => recaptchaRef.current?.reset(), 500);
        } catch (err) {
            setResendStatus('error');
            setResendMessage(err instanceof Error ? err.message : 'Failed to send link');
            setShowCaptchaModal(false);
            recaptchaRef.current?.reset();
        }
    };

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setStatus('error');
                setErrorMessage('Invalid verification link');
                return;
            }

            try {
                await verifyEmail(token);
                setStatus('success');
            } catch (err) {
                setStatus('error');
                setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
            }
        };

        verify();
    }, [token, verifyEmail]);

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#DDEF00]/10 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DDEF00]"></div>
                        </div>
                        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Verifying Email</h2>
                        <p className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>Please wait while we verify your email...</p>
                    </>
                );

            case 'success':
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Email Verified!</h2>
                        <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                            Your email has been verified successfully. You can now sign in to your account.
                        </p>
                        <Link to="/signin" className="inline-block py-3 px-6 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all">
                            Sign In
                        </Link>
                    </>
                );

            case 'error':
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Verification Failed</h2>
                        <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{errorMessage}</p>

                        {/* Resend verification section */}
                        <div className={`mt-6 pt-6 border-t ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
                            <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                                Need a new verification link?
                            </h3>
                            {resendStatus === 'success' ? (
                                <div className="p-3 bg-green-500/10 text-green-500 rounded-lg text-sm mb-4">
                                    {resendMessage}
                                </div>
                            ) : (
                                <form onSubmit={initiateResend} className="space-y-3 max-w-xs mx-auto">
                                    <input
                                        type="email"
                                        placeholder="Enter your email address"
                                        value={resendEmail}
                                        onChange={(e) => setResendEmail(e.target.value)}
                                        className={`w-full px-4 py-2 rounded-lg border text-sm outline-none transition-all ${isDark
                                            ? 'bg-neutral-800 border-neutral-700 text-white focus:border-[#DDEF00]'
                                            : 'bg-white border-neutral-300 text-neutral-900 focus:border-[#DDEF00]'
                                            }`}
                                        required
                                    />

                                    {resendStatus === 'error' && (
                                        <p className="text-xs text-red-500">{resendMessage}</p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={resendStatus === 'sending'}
                                        className="w-full py-2 px-4 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                                    >
                                        {resendStatus === 'sending' ? 'Sending...' : 'Resend Verification Link'}
                                    </button>
                                </form>
                            )}
                        </div>

                        <Link to="/signin" className={`mt-6 inline-block text-sm hover:underline ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                            Back to Sign In
                        </Link>
                    </>
                );
        }
    };

    return (
        <div className={`fixed inset-0 w-full min-h-screen flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}>
            <div className={`max-w-md p-8 rounded-2xl text-center ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
                <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" className="w-24 mx-auto mb-6" alt="FairArena Logo" />
                {renderContent()}
            </div>

            {/* Captcha Modal */}
            {showCaptchaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`relative w-full max-w-sm rounded-2xl p-6 shadow-2xl transform transition-all scale-100 ${isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'}`}>
                        <button
                            onClick={() => setShowCaptchaModal(false)}
                            className={`absolute top-4 right-4 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h3 className={`text-lg font-bold mb-2 text-center ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                            Security Check
                        </h3>
                        <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                            Please verify you are human to continue.
                        </p>

                        <div className="flex justify-center">
                            <ReCAPTCHA
                                ref={recaptchaRef}
                                sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
                                theme={isDark ? "dark" : "light"}
                                onChange={handleCaptchaChange}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
