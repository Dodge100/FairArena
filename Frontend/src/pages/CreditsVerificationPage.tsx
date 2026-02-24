/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Gift,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
} from 'lucide-react';
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

type PendingAction =
  | {
      type: 'send_otp';
      method: 'sms' | 'voice';
      isResend?: boolean;
    }
  | {
      type: 'verify_otp';
      method: 'sms' | 'voice';
    }
  | {
      type: 'claim';
    }
  | null;

const CreditsVerificationPage = () => {
  const { isSignedIn } = useAuthState();
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
  const [resendTimer, setResendTimer] = useState<number>(0);
  const [verificationMethod, setVerificationMethod] = useState<'sms' | 'voice'>('sms');
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Modal State
  const [isCaptchaModalOpen, setIsCaptchaModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCountryDropdown && !(event.target as Element).closest('.country-selector')) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCountryDropdown]);

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      country.code.includes(countrySearch) ||
      country.search.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  const { data: eligibilityData, isLoading: checkingEligibility } = useQuery({
    queryKey: ['credits-eligibility', isSignedIn],
    queryFn: () =>
      apiRequest<{ success: boolean; data: any }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/check-eligibility`,
      ).then((res) => res.data),
    enabled: isSignedIn,
  });

  useEffect(() => {
    if (!isSignedIn) {
      navigate('/signin');
      return;
    }

    if (eligibilityData) {
      if (eligibilityData.hasClaimedFreeCredits) {
        toast.info('You have already claimed your free credits');
        navigate('/dashboard/credits');
      } else if (eligibilityData.phoneVerified) {
        setStep('claim');
      } else {
        setStep('phone');
      }
      setIsCheckingEligibility(false);
    }
  }, [isSignedIn, navigate, eligibilityData]);

  // Sync loading state
  useEffect(() => {
    setIsCheckingEligibility(checkingEligibility);
  }, [checkingEligibility]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const onCaptchaChange = useCallback(
    (token: string | null) => {
      if (token && pendingAction) {
        // Automatically trigger action when captcha is solved
        executePendingAction(token);
      }
    },
    [pendingAction],
  ); // Added dependency

  const executePendingAction = async (captcha: string) => {
    if (!pendingAction) return;

    // Close modal immediately or keep it?
    // Usually solving captcha closes modal and we show loading on the buttons or globally?
    // User asked: "first the user submit then open the captcha on the modal then after that do the final submit"
    // So we can assume we close modal and proceed, OR keep modal open if we want to show progress there?
    // Let's close modal and show progress on the form.
    setIsCaptchaModalOpen(false);

    try {
      switch (pendingAction.type) {
        case 'send_otp':
          await performSendOtp(pendingAction.method, pendingAction.isResend, captcha);
          break;
        case 'verify_otp':
          await performVerifyOtp(pendingAction.method, captcha);
          break;
        case 'claim':
          await performClaimCredits(captcha);
          break;
      }
    } catch (e) {
      console.error('Error executing action', e);
    } finally {
      setPendingAction(null);
    }
  };

  const initiateSendOtp = (method: 'sms' | 'voice', isResend: boolean = false) => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    // If resend timer active, block
    if (isResend && resendTimer > 0) return;

    setPendingAction({ type: 'send_otp', method, isResend });
    setIsCaptchaModalOpen(true);
  };

  const initiateVerifyOtp = (method: 'sms' | 'voice') => {
    if (!otp.trim() || otp.length < 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }
    setPendingAction({ type: 'verify_otp', method });
    setIsCaptchaModalOpen(true);
  };

  const initiateClaim = () => {
    if (hasClaimed) return;
    setPendingAction({ type: 'claim' });
    setIsCaptchaModalOpen(true);
  };

  const sendOtpMutation = useMutation({
    mutationFn: async ({
      method,
      isResend,
      captcha,
    }: {
      method: 'sms' | 'voice';
      isResend: boolean;
      captcha: string;
    }) => {
      const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
      const endpoint =
        method === 'voice' ? '/api/v1/credits/send-voice-otp' : '/api/v1/credits/send-sms-otp';
      return apiRequest<{
        success: boolean;
        alreadyVerified?: boolean;
        retryAfter?: number;
        message?: string;
      }>(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'X-Recaptcha-Token': captcha,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          countryCode: countryCode,
          isResend,
        }),
      });
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        const methodText = variables.method === 'voice' ? 'voice call' : 'SMS';
        toast.success(
          variables.isResend ? `New code sent via ${methodText}` : `Code sent via ${methodText}`,
        );
        if (!variables.isResend) setStep('otp');
        if (variables.isResend) setOtp('');
        setResendTimer(120);
      } else {
        // This branch might not be reached if apiRequest throws on non-success, but depends on API structure.
        // If apiRequest throws for 400/500, we handle in onError.
        // If success is false but status 200 (custom logic), we handle here.
        // Assuming apiRequest handles non-200.
      }
    },
    onError: (error: any) => {
      const data = error.data || {};
      if (data.alreadyVerified) {
        toast.info('Phone already verified! You can now claim your credits.');
        setStep('claim');
      } else if (data.retryAfter) {
        setResendTimer(data.retryAfter);
        toast.error(error.message || `Please wait before requesting a new code`);
      } else {
        toast.error(error.message || 'Failed to send verification code');
      }
    },
    onSettled: () => {
      setIsSendingOtp(false);
      recaptchaRef.current?.reset();
    },
  });

  const performSendOtp = async (
    method: 'sms' | 'voice',
    isResend: boolean = false,
    captcha: string,
  ) => {
    setIsSendingOtp(true);
    sendOtpMutation.mutate({ method, isResend, captcha });
  };

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ method, captcha }: { method: 'sms' | 'voice'; captcha: string }) => {
      const endpoint =
        method === 'voice' ? '/api/v1/credits/verify-voice-otp' : '/api/v1/credits/verify-sms-otp';
      return apiRequest<{ success: boolean; expired?: boolean; message?: string }>(
        `${import.meta.env.VITE_API_BASE_URL}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'X-Recaptcha-Token': captcha,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ otp }),
        },
      );
    },
    onSuccess: () => {
      toast.success('Phone verified successfully');
      setStep('claim');
    },
    onError: (error: any) => {
      const data = error.data || {};
      if (data.expired) {
        toast.error('Code expired. Please request a new one.');
        setOtp('');
        setResendTimer(0);
      } else {
        toast.error(error.message || 'Invalid code');
      }
    },
    onSettled: () => {
      setIsVerifyingOtp(false);
      recaptchaRef.current?.reset();
    },
  });

  const performVerifyOtp = async (method: 'sms' | 'voice', captcha: string) => {
    setIsVerifyingOtp(true);
    verifyOtpMutation.mutate({ method, captcha });
  };

  const claimMutation = useMutation({
    mutationFn: async (captcha: string) => {
      return apiRequest<{ success: boolean; message?: string }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/claim-free`,
        {
          method: 'POST',
          headers: {
            'X-Recaptcha-Token': captcha,
            'Content-Type': 'application/json',
          },
        },
      );
    },
    onSuccess: () => {
      toast.success('Credits claimed successfully!');
      setHasClaimed(true);
      const cacheBuster = Date.now();
      setTimeout(() => {
        navigate(`/dashboard/credits?refresh=${cacheBuster}`);
      }, 1500);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to claim credits');
    },
    onSettled: () => {
      setIsClaiming(false);
      recaptchaRef.current?.reset();
    },
  });

  const performClaimCredits = async (captcha: string) => {
    setIsClaiming(true);
    claimMutation.mutate(captcha);
  };

  // Reset captcha when modal closes manually
  const onModalOpenChange = (open: boolean) => {
    setIsCaptchaModalOpen(open);
    if (!open) {
      setPendingAction(null);
      recaptchaRef.current?.reset();
    }
  };

  const resetPhoneStep = () => {
    setStep('phone');
    setOtp('');
    // Keep resend timer running? Usually better to keep it if it's running
  };

  if (!isSignedIn || isCheckingEligibility) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-primary/5 rounded-2xl mb-4 ring-1 ring-primary/10">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Claim Free Credits</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Verify your phone number to unlock{' '}
            <span className="font-semibold text-foreground">200 credits</span>.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center space-x-2">
          {['phone', 'otp', 'claim'].map((s, i) => {
            const isActive = step === s;
            const isCompleted =
              (step === 'otp' && i === 0) || (step === 'claim' && i <= 1) || hasClaimed;

            return (
              <div key={s} className="flex items-center">
                <div
                  className={cn(
                    'h-2 w-16 rounded-full transition-all duration-300',
                    isActive ? 'bg-primary' : isCompleted ? 'bg-primary/40' : 'bg-secondary',
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Dynamic Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          {step === 'phone' && (
            <Card className="border shadow-none bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium">Phone Verification</CardTitle>
                <CardDescription>Enter your phone number to verify your identity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <div className="relative country-selector">
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-[100px] justify-between px-3"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="text-base">
                            {countries.find((c) => c.code === countryCode)?.flag}
                          </span>
                          <span className="text-xs text-muted-foreground">{countryCode}</span>
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                      {showCountryDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-[300px] bg-popover rounded-md border shadow-md z-50 max-h-[300px] overflow-hidden flex flex-col">
                          <div className="p-2 border-b sticky top-0 bg-popover z-10">
                            <Input
                              placeholder="Search country..."
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                            />
                          </div>
                          <div className="overflow-y-auto flex-1 p-1">
                            {filteredCountries.map((country) => (
                              <button
                                key={country.code}
                                onClick={() => {
                                  setCountryCode(country.code);
                                  setShowCountryDropdown(false);
                                  setCountrySearch('');
                                }}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors',
                                  countryCode === country.code && 'bg-accent/50',
                                )}
                              >
                                <span className="text-lg">{country.flag}</span>
                                <span className="flex-1 truncate">{country.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  {country.code}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="987 654 3210"
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 10) setPhoneNumber(val);
                      }}
                      className="flex-1 font-mono tracking-wide"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Verification Method</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      role="button"
                      onClick={() => setVerificationMethod('sms')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                        verificationMethod === 'sms'
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background hover:bg-muted',
                      )}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-sm font-medium">SMS</span>
                    </div>
                    <div
                      role="button"
                      onClick={() => setVerificationMethod('voice')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                        verificationMethod === 'voice'
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background hover:bg-muted',
                      )}
                    >
                      <Phone className="h-4 w-4" />
                      <span className="text-sm font-medium">Call</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <Button
                    onClick={() => initiateSendOtp(verificationMethod)}
                    disabled={isSendingOtp || phoneNumber.length < 10}
                    className="w-full"
                    size="lg"
                  >
                    {isSendingOtp ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                      </>
                    ) : (
                      'Send Verification Code'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setStep('otp')}
                  >
                    Already have a code?
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'otp' && (
            <Card className="border shadow-none bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-medium">Enter Code</CardTitle>
                <CardDescription>
                  We sent a code to{' '}
                  <span className="font-mono text-foreground">
                    {countryCode} {phoneNumber}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="sr-only">
                    Verification Code
                  </Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) =>
                      setOtp(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 12),
                      )
                    }
                    placeholder="ENTER CODE"
                    className="text-center text-2xl font-mono tracking-[0.5em] h-14 uppercase"
                    maxLength={12}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Code expires in 15 minutes.
                  </p>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={resetPhoneStep}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button
                      onClick={() => initiateVerifyOtp(verificationMethod)}
                      disabled={isVerifyingOtp || otp.length < 6}
                    >
                      {isVerifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resendTimer > 0 || isSendingOtp}
                    onClick={() => initiateSendOtp(verificationMethod, true)}
                    className="w-full text-muted-foreground"
                  >
                    {resendTimer > 0 ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Resend in {Math.floor(resendTimer / 60)}:
                        {String(resendTimer % 60).padStart(2, '0')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-3 w-3" />
                        Resend Code
                      </span>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'claim' && (
            <Card className="border shadow-none bg-card text-center relative overflow-hidden">
              <CardHeader className="pb-2">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Verified!</CardTitle>
                <CardDescription>Your phone number has been successfully linked.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pb-8">
                <div className="bg-secondary/50 rounded-xl p-6 border border-border/50">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Claim Reward
                  </p>
                  <div className="text-5xl font-extrabold text-foreground mb-1">200</div>
                  <div className="text-sm font-semibold text-foreground">Free Credits</div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground max-w-xs mx-auto text-left">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Instant activation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Full platform access</span>
                    </div>
                  </div>

                  <Button
                    onClick={initiateClaim}
                    disabled={isClaiming || hasClaimed}
                    className="w-full"
                    size="lg"
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming...
                      </>
                    ) : (
                      'Claim Credits Now'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Captcha Modal */}
      <Dialog open={isCaptchaModalOpen} onOpenChange={onModalOpenChange}>
        <DialogContent className="sm:max-w-[400px] flex flex-col items-center">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-center">Security Check</DialogTitle>
            <DialogDescription className="text-center">
              Please complete the captcha to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center my-2">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY}
              onChange={onCaptchaChange}
              theme="light"
            />
          </div>
          {/* Optional loader or msg if user triggered it and is waiting */}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreditsVerificationPage;
