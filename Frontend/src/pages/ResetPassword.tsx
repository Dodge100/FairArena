import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

export default function ResetPassword() {
    const { theme, isDark } = useTheme();
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { resetPassword } = useAuth();

    // Validate token on mount
    useEffect(() => {
        if (!token) {
            toast.error('Invalid password reset link');
            navigate('/', { replace: true });
        }
    }, [token, navigate]);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showCaptcha, setShowCaptcha] = useState(false);

    const validatePassword = (pwd: string): string[] => {
        const errors: string[] = [];
        if (pwd.length < 8) errors.push('At least 8 characters');
        if (!/[A-Z]/.test(pwd)) errors.push('One uppercase letter');
        if (!/[a-z]/.test(pwd)) errors.push('One lowercase letter');
        if (!/\d/.test(pwd)) errors.push('One number');
        return errors;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError('Invalid reset link');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            setError(`Password must have: ${passwordErrors.join(', ')}`);
            return;
        }

        setShowCaptcha(true);
    };

    const handleCaptchaVerify = async (captchaToken: string | null) => {
        if (!captchaToken || !token) return;
        setShowCaptcha(false);
        setIsLoading(true);

        try {
            await resetPassword(token, password, captchaToken);
            setSuccess(true);
            toast.success('Password reset successfully!');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to reset password';
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className={`fixed inset-0 w-full min-h-screen flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}>
                <div className={`max-w-md p-8 rounded-2xl text-center ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Password Reset!</h2>
                    <p className={`mb-6 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Your password has been reset successfully. You can now sign in with your new password.
                    </p>
                    <Link to="/signin" className="inline-block py-3 px-6 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all">
                        Sign In
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 w-full min-h-screen flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-neutral-100'}`}>
            <div className={`w-full max-w-md p-8 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
                <div className="text-center mb-6">
                    <img src="https://fairarena.blob.core.windows.net/fairarena/fairArenaLogo.png" className="w-24 mx-auto mb-4" alt="FairArena Logo" />
                    <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Reset Password</h1>
                    <p className={`mt-2 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>Enter your new password below.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">{error}</div>
                    )}

                    <div>
                        <label htmlFor="password" className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                            New Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
                        />
                        <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number</p>
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] focus:border-[#DDEF00]' : 'bg-white text-neutral-900 border-[#e6e6e6] focus:border-[#DDEF00]'} focus:outline-none`}
                        />
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full py-3 px-4 bg-[#DDEF00] hover:bg-[#c7db00] text-black rounded-lg font-semibold transition-all disabled:opacity-50">
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            </div>
            {/* Captcha Modal */}
            <Dialog open={showCaptcha} onOpenChange={setShowCaptcha}>
                <DialogContent className={`sm:max-w-md ${isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white'}`}>
                    <DialogHeader>
                        <DialogTitle>Security Verification</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center p-4">
                        <ReCAPTCHA
                            sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
                            theme={isDark ? 'dark' : 'light'}
                            onChange={handleCaptchaVerify}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
