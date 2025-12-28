import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Gift, Info, Phone, RefreshCw, Shield, Users, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthState } from '../lib/auth';

const countries = [
  { code: '+1', name: 'United States', flag: '🇺🇸', search: 'usa us america united states' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', search: 'uk united kingdom britain england' },
  { code: '+91', name: 'India', flag: '🇮🇳', search: 'india indian' },
  { code: '+86', name: 'China', flag: '🇨🇳', search: 'china chinese' },
  { code: '+81', name: 'Japan', flag: '🇯🇵', search: 'japan japanese' },
  { code: '+49', name: 'Germany', flag: '🇩🇪', search: 'germany german deutschland' },
  { code: '+33', name: 'France', flag: '🇫🇷', search: 'france french' },
  { code: '+61', name: 'Australia', flag: '🇦🇺', search: 'australia australian aussie' },
  { code: '+7', name: 'Russia', flag: '🇷🇺', search: 'russia russian' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷', search: 'brazil brazilian' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬', search: 'nigeria nigerian' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦', search: 'south africa african' },
  { code: '+20', name: 'Egypt', flag: '🇪🇬', search: 'egypt egyptian' },
  { code: '+971', name: 'UAE', flag: '🇦🇪', search: 'uae emirates dubai' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', search: 'saudi arabia arabian' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷', search: 'south korea korean' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', search: 'singapore singaporean' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾', search: 'malaysia malaysian' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩', search: 'indonesia indonesian' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭', search: 'philippines filipino' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭', search: 'thailand thai' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳', search: 'vietnam vietnamese' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩', search: 'bangladesh bangladeshi' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', search: 'pakistan pakistani' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰', search: 'sri lanka lankan' },
  { code: '+977', name: 'Nepal', flag: '🇳🇵', search: 'nepal nepali' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽', search: 'mexico mexican' },
  { code: '+34', name: 'Spain', flag: '🇪🇸', search: 'spain spanish' },
  { code: '+39', name: 'Italy', flag: '🇮🇹', search: 'italy italian' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹', search: 'portugal portuguese' },
];

const CreditsVerificationPage = () => {
  const { isSignedIn, getToken } = useAuthState();
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'otp' | 'claim'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [resendTimer, setResendTimer] = useState<number>(0);
  const [verificationMethod, setVerificationMethod] = useState<'sms' | 'voice'>('sms');
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      country.code.includes(countrySearch) ||
      country.search.toLowerCase().includes(countrySearch.toLowerCase())
  );

  useEffect(() => {
    if (!isSignedIn) {
      navigate('/signin');
      return;
    }

    // Check if user has already claimed or is verified
    const checkEligibility = async () => {
      try {
        const token = await getToken();
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/check-eligibility`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // If already claimed, redirect to credits page
            if (data.data.hasClaimedFreeCredits) {
              toast.info('You have already claimed your free credits');
              navigate('/dashboard/credits');
              return;
            }
            // If phone verified (from database OR redis), go directly to claim step
            // This fixes the issue where users who refreshed the page after verification
            // would be stuck on the phone step instead of the claim step
            if (data.data.phoneVerified) {
              toast.success('Phone already verified! Ready to claim your credits.');
              setStep('claim');
            } else {
              // Not verified yet - stay on phone step
              setStep('phone');
            }
          }
        }
      } catch (error) {
        console.error('Error checking eligibility:', error);
        toast.error('Failed to check eligibility. Please refresh the page.');
      } finally {
        setIsCheckingEligibility(false);
      }
    };

    checkEligibility();
  }, [isSignedIn, navigate, getToken]);

  // Resend timer effect
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const onCaptchaChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  const onCaptchaExpired = useCallback(() => {
    setCaptchaToken(null);
  }, []);

  const getRecaptchaToken = useCallback(async () => {
    if (!captchaToken) {
      toast.error('Please complete the CAPTCHA');
      return '';
    }
    return captchaToken;
  }, [captchaToken]);

  const sendOtp = async (method: 'sms' | 'voice' = verificationMethod) => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    // Ensure phone number contains only digits
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    setIsSendingOtp(true);
    try {
      const captcha = await getRecaptchaToken();
      if (!captcha) {
        setIsSendingOtp(false);
        return;
      }

      const token = await getToken();
      const endpoint = method === 'voice' ? '/api/v1/credits/send-voice-otp' : '/api/v1/credits/send-sms-otp';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Recaptcha-Token': captcha,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          countryCode: countryCode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const methodText = method === 'voice' ? 'voice call' : 'SMS';
        toast.success(`OTP sent via ${methodText} to your phone number`);
        setStep('otp');
        setOtpSentAt(Date.now());
        setResendTimer(120); // 2 minutes
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        // Check if already verified
        if (data.alreadyVerified) {
          toast.info('Your phone is already verified! Redirecting to claim...');
          setStep('claim');
        } else {
          toast.error(data.message || 'Failed to send OTP');
        }
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      }
    } catch (error) {
      console.error(`Error sending ${method} OTP:`, error);
      toast.error('Failed to send OTP. Please try again.');
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    } finally {
      setIsSendingOtp(false);
    }
  };

  const sendSmsOtp = () => sendOtp('sms');
  const sendVoiceOtp = () => sendOtp('voice');

  const resendOtp = async (method: 'sms' | 'voice' = verificationMethod) => {
    if (resendTimer > 0) {
      toast.error(`Please wait ${resendTimer} seconds before requesting a new code`);
      return;
    }

    // Validate phone number exists
    if (!phoneNumber || !countryCode) {
      toast.error('Phone number information missing. Please enter your phone number again.');
      setStep('phone');
      return;
    }

    // Ensure phone number is valid
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      setStep('phone'); // Go back to phone step to fix
      return;
    }

    // Update phoneNumber state with cleaned version
    setPhoneNumber(cleanPhone);

    setIsSendingOtp(true);
    try {
      const captcha = await getRecaptchaToken();
      if (!captcha) {
        setIsSendingOtp(false);
        return;
      }

      const token = await getToken();
      const endpoint = method === 'voice' ? '/api/v1/credits/send-voice-otp' : '/api/v1/credits/send-sms-otp';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Recaptcha-Token': captcha,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          countryCode: countryCode,
          isResend: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const methodText = method === 'voice' ? 'voice call' : 'SMS';
        toast.success(`New OTP sent via ${methodText} to your phone number`);
        setOtp(''); // Clear existing OTP input
        setOtpSentAt(Date.now());
        setResendTimer(120); // Reset to 2 minutes
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        // Handle rate limit response
        if (data.retryAfter) {
          setResendTimer(data.retryAfter);
          toast.error(data.message || `Please wait before requesting a new code`);
        } else {
          toast.error(data.message || 'Failed to resend OTP');
        }
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      }
    } catch (error) {
      console.error(`Error resending ${method} OTP:`, error);
      toast.error('Failed to resend OTP. Please try again.');
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    } finally {
      setIsSendingOtp(false);
    }
  };

  const resendSmsOtp = () => resendOtp('sms');
  const resendVoiceOtp = () => resendOtp('voice');

  const verifyOtp = async (method: 'sms' | 'voice' = verificationMethod) => {
    if (!otp.trim() || otp.length < 6) {
      toast.error('Please enter a valid OTP (6 digits or 6-12 characters)');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const captcha = await getRecaptchaToken();
      if (!captcha) {
        setIsVerifyingOtp(false);
        return;
      }

      const token = await getToken();
      const endpoint = method === 'voice' ? '/api/v1/credits/verify-voice-otp' : '/api/v1/credits/verify-sms-otp';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Recaptcha-Token': captcha,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        if (data.data?.warning) {
          // Partial success - phone verified but DB update pending
          toast.warning(data.data.warning, { duration: 5000 });
        } else {
          toast.success('Phone number verified successfully!');
        }
        setStep('claim');
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      } else {
        // Check if OTP expired
        if (data.expired) {
          toast.error('OTP has expired (valid for 15 minutes). Use the Resend button to get a new code.', { duration: 6000 });
          setOtp('');
          // Reset timer to allow immediate resend
          setResendTimer(0);
        } else {
          toast.error(data.message || 'Invalid OTP');
        }
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      }
    } catch (error) {
      console.error(`Error verifying ${method} OTP:`, error);
      toast.error('Failed to verify OTP. Please try again.');
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const verifySmsOtp = () => verifyOtp('sms');
  const verifyVoiceOtp = () => verifyOtp('voice');

  const handleClaimCredits = useCallback(async () => {
    if (hasClaimed) return;

    setIsClaiming(true);
    try {
      const captcha = await getRecaptchaToken();
      if (!captcha) {
        setIsClaiming(false);
        return;
      }

      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/claim-free`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Recaptcha-Token': captcha,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Congratulations! 200 free credits have been added to your account!');
        setHasClaimed(true);
        setCaptchaToken(null);
        recaptchaRef.current?.reset();

        // Force cache invalidation by adding timestamp to URL
        const cacheBuster = Date.now();

        // Redirect to credits page after a short delay with cache buster
        setTimeout(() => {
          navigate(`/dashboard/credits?refresh=${cacheBuster}`);
        }, 2000);
      } else {
        toast.error(data.message || 'Failed to claim free credits');
        setCaptchaToken(null);
        recaptchaRef.current?.reset();
      }
    } catch (error) {
      console.error('Error claiming credits:', error);
      toast.error('Failed to claim free credits. Please try again.');
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    } finally {
      setIsClaiming(false);
    }
  }, [getToken, hasClaimed, navigate, getRecaptchaToken]);

  if (!isSignedIn || isCheckingEligibility) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-4 md:left-10 w-32 h-32 md:w-72 md:h-72 bg-blue-400/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-4 md:right-10 w-40 h-40 md:w-96 md:h-96 bg-indigo-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8 md:mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-linear-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 md:mb-6 shadow-xl">
            <Gift className="h-8 w-8 md:h-10 md:w-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold bg-linear-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent mb-4 md:mb-6 tracking-tight px-2">
            Claim Free Credits
          </h1>
          <p className="text-base md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed px-4">
            Verify your phone number to unlock <span className="font-bold text-blue-600 dark:text-blue-400">200 free credits</span> and kickstart your hackathon journey!
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8 md:mb-12">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 md:p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-4 md:space-x-6">
              <div className="flex flex-col items-center gap-2">
                <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl transition-all shadow-lg ${step === 'phone' || step === 'otp' || step === 'claim'
                  ? 'bg-linear-to-br from-blue-500 to-indigo-600 text-white scale-110'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                  <Phone className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Phone</span>
              </div>
              <div className={`w-12 h-2 md:w-16 md:h-2 rounded-full transition-all ${step === 'otp' || step === 'claim' ? 'bg-linear-to-r from-blue-500 to-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}></div>
              <div className="flex flex-col items-center gap-2">
                <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl transition-all shadow-lg ${step === 'otp' || step === 'claim'
                  ? 'bg-linear-to-br from-blue-500 to-indigo-600 text-white scale-110'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                  <Shield className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Verify</span>
              </div>
              <div className={`w-12 h-2 md:w-16 md:h-2 rounded-full transition-all ${step === 'claim' ? 'bg-linear-to-r from-blue-500 to-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}></div>
              <div className="flex flex-col items-center gap-2">
                <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl transition-all shadow-lg ${step === 'claim'
                  ? 'bg-linear-to-br from-blue-500 to-indigo-600 text-white scale-110'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                  <Gift className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Claim</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {step === 'phone' && (
          <Card className="mb-8 border-0 shadow-xl bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500 text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-black/10"></div>
            <CardHeader className="pb-6 relative z-10">
              <CardTitle className="text-2xl font-bold">Phone Verification</CardTitle>
              <CardDescription className="text-blue-100">
                Enter your phone number to receive a verification code
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 space-y-6">
              <div className="space-y-3">
                <Label htmlFor="phone" className="text-white text-lg font-semibold">Phone Number</Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Country Code Selector */}
                  <div className="relative w-full sm:w-48">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="w-full bg-white/15 backdrop-blur-sm border-2 border-white/30 text-white rounded-lg px-4 py-3 flex items-center justify-between hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/60 shadow-lg"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-2xl">{countries.find(c => c.code === countryCode)?.flag}</span>
                        <span className="font-medium">{countryCode}</span>
                      </span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showCountryDropdown && (
                      <div className="absolute top-full mt-2 w-80 bg-slate-800 rounded-lg shadow-2xl border-2 border-white/20 z-50 max-h-96 overflow-hidden">
                        <div className="p-3 border-b border-white/10">
                          <input
                            type="text"
                            placeholder="Search country..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="w-full bg-slate-700 text-white placeholder:text-slate-400 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto max-h-80">
                          {filteredCountries.length > 0 ? (
                            filteredCountries.map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  setCountryCode(country.code);
                                  setShowCountryDropdown(false);
                                  setCountrySearch('');
                                }}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 transition-colors text-left ${countryCode === country.code ? 'bg-slate-700' : ''
                                  }`}
                              >
                                <span className="text-2xl">{country.flag}</span>
                                <span className="flex-1 text-white font-medium">{country.name}</span>
                                <span className="text-slate-400">{country.code}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-8 text-center text-slate-400">
                              No countries found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Phone Number Input */}
                  <div className="flex-1">
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="1234567890"
                      value={phoneNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                          setPhoneNumber(value);
                        }
                      }}
                      maxLength={10}
                      className="bg-white/15 backdrop-blur-sm border-2 border-white/30 text-white text-lg placeholder:text-white/50 h-13 focus:bg-white/20 transition-all shadow-lg"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 rounded-lg p-3">
                  <Info className="h-5 w-5 text-blue-200 shrink-0 mt-0.5" />
                  <p className="text-blue-100 text-sm">
                    Enter your phone number without country code (maximum 10 digits). We'll send you a verification code.
                  </p>
                </div>

                {/* Verification Method Selection */}
                <div className="space-y-3">
                  <Label className="text-white font-semibold">Choose verification method:</Label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setVerificationMethod('sms')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${verificationMethod === 'sms'
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-white/10 border-white/30 text-white/70 hover:bg-white/20'
                        }`}
                    >
                      <Phone className="h-4 w-4" />
                      SMS Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerificationMethod('voice')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${verificationMethod === 'voice'
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-white/10 border-white/30 text-white/70 hover:bg-white/20'
                        }`}
                    >
                      <Phone className="h-4 w-4" />
                      Voice Call
                    </button>
                  </div>
                  <p className="text-white/60 text-sm">
                    {verificationMethod === 'sms'
                      ? 'Receive a text message with your verification code'
                      : 'Receive an automated voice call with your verification code'
                    }
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
                  onChange={onCaptchaChange}
                  onExpired={onCaptchaExpired}
                  theme="dark"
                />
              </div>

              <div className="space-y-3">
                <Button
                  onClick={verificationMethod === 'voice' ? sendVoiceOtp : sendSmsOtp}
                  disabled={isSendingOtp || !phoneNumber.trim() || phoneNumber.length < 10 || !captchaToken}
                  className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold text-lg h-14 shadow-xl transition-all hover:scale-105 disabled:hover:scale-100"
                >
                  {isSendingOtp ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Sending Code...
                    </>
                  ) : (
                    <>
                      <Phone className="h-5 w-5 mr-2" />
                      Send {verificationMethod === 'voice' ? 'Voice Call' : 'SMS'} Code
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    setStep('otp');
                    toast.info('Enter the code sent to your phone');
                  }}
                  variant="outline"
                  className="w-full bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/20 h-12 font-semibold transition-all"
                >
                  Already Have a Code?
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'otp' && (
          <Card className="mb-12 border-0 shadow-2xl bg-linear-to-br from-purple-600 via-pink-600 to-rose-600 text-white overflow-hidden relative transform transition-all hover:scale-[1.01]">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]"></div>
            <CardHeader className="pb-8 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold">Enter Verification Code</CardTitle>
                  <CardDescription className="text-purple-100 text-base mt-1">
                    We've sent a code to {countryCode} {phoneNumber}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 space-y-6 pb-8">
              <div className="space-y-3">
                <Label htmlFor="otp" className="text-white text-lg font-semibold">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter your code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                  className="bg-white/15 backdrop-blur-sm border-2 border-white/30 text-white placeholder:text-white/50 text-center text-3xl tracking-[0.5em] font-bold h-16 focus:bg-white/20 transition-all shadow-lg"
                  maxLength={12}
                  autoFocus
                />
                <div className="flex items-start gap-2 bg-purple-500/30 backdrop-blur-sm border border-purple-300/30 rounded-lg p-3 mt-3">
                  <Info className="h-5 w-5 text-purple-100 shrink-0 mt-0.5" />
                  <p className="text-purple-100 text-sm">
                    Code is 6 digits (numeric) or 6-12 characters (alphanumeric). Expires in 15 minutes. You can request a new code after 2 minutes.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
                  onChange={onCaptchaChange}
                  onExpired={onCaptchaExpired}
                  theme="dark"
                />
              </div>

              <div className="space-y-3">
                <div className="flex gap-4">
                  <Button
                    onClick={() => {
                      setStep('phone');
                      setOtp('');
                      // Don't clear otpSentAt so "Already Have Code" button remains visible
                    }}
                    variant="outline"
                    className="flex-1 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/20 h-12 font-semibold transition-all"
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={verificationMethod === 'voice' ? verifyVoiceOtp : verifySmsOtp}
                    disabled={isVerifyingOtp || otp.length < 6 || !captchaToken}
                    className="flex-1 bg-white text-purple-600 hover:bg-purple-50 font-bold text-lg h-12 shadow-lg transition-all hover:scale-105 disabled:hover:scale-100"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-2"></div>
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Shield className="h-5 w-5 mr-2" />
                        Verify Code
                      </>
                    )}
                  </Button>
                </div>

                <Button
                  onClick={verificationMethod === 'voice' ? resendVoiceOtp : resendSmsOtp}
                  disabled={resendTimer > 0 || isSendingOtp || !captchaToken}
                  variant="outline"
                  className="w-full bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/20 h-12 font-semibold transition-all"
                >
                  {resendTimer > 0 ? (
                    `Resend Code in ${Math.floor(resendTimer / 60)}:${(resendTimer % 60).toString().padStart(2, '0')}`
                  ) : isSendingOtp ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2" />
                      Resend {verificationMethod === 'voice' ? 'Voice Call' : 'SMS'} Code
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'claim' && (
          <Card className="mb-12 border-0 shadow-2xl bg-linear-to-br from-blue-600 via-indigo-600 to-purple-600 text-white overflow-hidden relative transform transition-all hover:scale-[1.01]">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.15),transparent)]"></div>
            <CardHeader className="pb-8 relative z-10">
              <div className="text-center">
                <div className="inline-flex bg-white/20 backdrop-blur-sm p-4 rounded-2xl mb-4 animate-pulse">
                  <Gift className="h-10 w-10" />
                </div>
                <CardTitle className="text-4xl font-bold mb-3">🎉 Ready to Claim!</CardTitle>
                <CardDescription className="text-blue-100 text-lg">
                  Your phone is verified. Claim your welcome bonus now!
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pb-8">
              <div className="text-center space-y-6">
                <div className="bg-white/15 backdrop-blur-sm border-2 border-white/30 rounded-2xl p-8">
                  <p className="text-white/80 text-sm font-medium mb-2">You will receive</p>
                  <div className="text-7xl font-bold mb-2">200</div>
                  <p className="text-white/90 text-xl font-semibold">Free Credits</p>
                </div>

                <div className="space-y-3 bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 rounded-xl p-5 text-left">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-blue-200 shrink-0" />
                    <span className="text-blue-100 text-base">Instant credit activation</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-blue-200 shrink-0" />
                    <span className="text-blue-100 text-base">Create and manage hackathons</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-blue-200 shrink-0" />
                    <span className="text-blue-100 text-base">One-time welcome bonus</span>
                  </div>
                </div>

                {hasClaimed ? (
                  <div className="space-y-4">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6">
                      <div className="flex items-center justify-center gap-3 text-blue-100 mb-2">
                        <CheckCircle className="h-7 w-7" />
                        <span className="text-2xl font-bold">Success!</span>
                      </div>
                      <p className="text-blue-100 text-lg">
                        Your credits have been added. Redirecting...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                      <Label className="text-white/90 text-sm font-medium mb-2 block text-center">
                        Complete the security check to claim your credits
                      </Label>
                      <div className="flex justify-center">
                        <ReCAPTCHA
                          ref={recaptchaRef}
                          sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
                          onChange={onCaptchaChange}
                          onExpired={onCaptchaExpired}
                          theme="dark"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleClaimCredits}
                      disabled={isClaiming || !captchaToken}
                      className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold text-xl h-16 shadow-2xl transition-all hover:scale-105 disabled:hover:scale-100"
                    >
                      {isClaiming ? (
                        <>
                          <div className="animate-spin rounded-full h-7 w-7 border-b-3 border-blue-600 mr-3"></div>
                          Claiming Your Credits...
                        </>
                      ) : (
                        <>
                          <Gift className="h-7 w-7 mr-3" />
                          Claim 200 Free Credits Now
                        </>
                      )}
                    </Button>
                  </div>)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4">
                <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Instant Access</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Credits are added immediately to your account balance
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full mb-4">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Create Hackathons</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Use credits to launch and manage your hackathon events
              </p>
            </CardContent>
          </Card>

          <Card className="text-center md:col-span-2 lg:col-span-1">
            <CardContent className="p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-full mb-4">
                <Shield className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure Verification</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Phone verification ensures account security and prevents abuse
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Terms */}
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">Terms & Conditions</h3>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <p>• Free credits are available for all verified users</p>
                <p>• One-time claim per user account</p>
                <p>• Phone verification is required for security</p>
                <p>• Credits cannot be transferred or refunded</p>
                <p>• Valid for creating and managing hackathons on FairArena</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreditsVerificationPage;
