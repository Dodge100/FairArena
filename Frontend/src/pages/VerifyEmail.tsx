import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function VerifyEmail() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { token } = useParams<{ token: string }>();
    const { verifyEmail } = useAuth();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');

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
                        <Link to="/signin" className="inline-block py-3 px-6 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all">
                            Go to Sign In
                        </Link>
                    </>
                );
        }
    };

    return (
        <div className={`fixed inset-0 w-full min-h-screen flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}>
            <div className={`max-w-md p-8 rounded-2xl text-center ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
                <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" className="w-24 mx-auto mb-6" alt="Fair Arena Logo" />
                {renderContent()}
            </div>
        </div>
    );
}
