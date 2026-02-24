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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { apiRequest } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  CreditCard,
  Crown,
  ExternalLink,
  Gift,
  History,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Ticket as TicketIcon,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthState } from '../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditBalance { balance: number; userId: string; }

interface CreditTransaction {
  id: string; amount: number; balance: number; type: string;
  description: string; metadata?: Record<string, unknown>; createdAt: string;
  payment?: { razorpayOrderId: string; razorpayPaymentId: string; planName: string; amount: number; status: string; };
}

interface CreditHistory { transactions: CreditTransaction[]; total: number; limit: number; offset: number; }

interface PaymentDetails {
  id: string; razorpayOrderId: string; razorpayPaymentId?: string; planName: string;
  amount: number; currency: string; credits: number; status: string;
  createdAt: string; completedAt?: string; invoiceUrl?: string;
}

interface CreditPlan {
  id: string; planId: string; name: string; amount: number; currency: string;
  credits: number; description?: string; features: string[]; isActive: boolean;
}

interface AchievementData {
  id: string; achievementKey: string; title: string; description: string;
  howToReach: string; icon: string; rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  category: string; xpReward: number; unlocked: boolean;
  unlockedAt: string | null; progress: number; nudgeText: string;
}

interface SpendingTier { key: string; label: string; minPaise: number; color: string; }

interface GamificationStatus {
  loginStreak: number; longestStreak: number; level: number; xp: number;
  xpToNextLevel: number; levelProgress: number; totalSpentPaise: number;
  totalPurchases: number; totalCreditsEarned: number;
  tier: SpendingTier; tierProgress: number; nextTierLabel: string;
  nextTierAmountNeeded: number; checkedInToday: boolean;
  achievements: AchievementData[]; newlyUnlocked: string[];
  closestLocked: AchievementData | null;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

// ─── Rarity helpers ───────────────────────────────────────────────────────────

const RARITY_STYLES: Record<string, { ring: string; badge: string; glow: string; label: string }> = {
  COMMON: { ring: 'ring-1 ring-muted', badge: 'bg-muted text-muted-foreground', glow: '', label: 'Common' },
  RARE: { ring: 'ring-2 ring-blue-500/50', badge: 'bg-blue-500/20 text-blue-400', glow: 'shadow-[0_0_12px_rgba(59,130,246,0.35)]', label: 'Rare' },
  EPIC: { ring: 'ring-2 ring-purple-500/60', badge: 'bg-purple-500/20 text-purple-400', glow: 'shadow-[0_0_16px_rgba(168,85,247,0.4)]', label: 'Epic' },
  LEGENDARY: { ring: 'ring-2 ring-yellow-400/70', badge: 'bg-yellow-500/20 text-yellow-300', glow: 'shadow-[0_0_24px_rgba(250,204,21,0.5)] animate-pulse', label: 'Legendary' },
};

const TIER_COLORS: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-slate-400 to-slate-300',
  gold: 'from-yellow-500 to-yellow-300',
  diamond: 'from-cyan-400 to-blue-300',
  legend: 'from-purple-500 to-pink-400',
};

// Pre-computed confetti data (module-level so Math.random is never called during render)
const CONFETTI_PIECES = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * 360;
  const dist = 120 + Math.random() * 200;
  const colors = ['#ffd700', '#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b'];
  return {
    dx: `${Math.cos((angle * Math.PI) / 180) * dist}px`,
    dy: `${Math.sin((angle * Math.PI) / 180) * dist}px`,
    delay: `${(Math.random() * 0.5).toFixed(2)}s`,
    size: 6 + Math.floor(Math.random() * 10),
    color: colors[i % colors.length],
  };
});

// ─── Confetti Overlay ─────────────────────────────────────────────────────────

function ConfettiOverlay({ achievement, onDone }: { achievement: AchievementData; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
      onClick={onDone}
    >
      {/* Confetti burst */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {CONFETTI_PIECES.map((p, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-sm opacity-0 animate-[confetti_0.9s_ease-out_forwards]"
            style={{
              width: p.size, height: p.size, background: p.color,
              animationDelay: p.delay,
              '--dx': p.dx, '--dy': p.dy,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-2xl bg-background/95 border shadow-2xl max-w-sm text-center animate-[scale-in_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="text-6xl">{achievement.icon}</div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Achievement Unlocked!</p>
          <h2 className="text-2xl font-bold">{achievement.title}</h2>
          <p className="text-muted-foreground text-sm mt-1">{achievement.description}</p>
        </div>
        <Badge className={cn('text-xs', RARITY_STYLES[achievement.rarity].badge)}>
          {RARITY_STYLES[achievement.rarity].label} · +{achievement.xpReward} XP
        </Badge>
        <p className="text-xs text-muted-foreground">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

// ─── Achievement Card ─────────────────────────────────────────────────────────

function AchievementCard({ ach }: { ach: AchievementData }) {
  const rs = RARITY_STYLES[ach.rarity];
  const completedDate = ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : null;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 p-4 rounded-xl border bg-card transition-all duration-200',
        ach.unlocked ? [rs.ring, rs.glow, 'border-transparent'] : 'border-muted/40 opacity-70',
      )}
    >
      {/* Lock overlay */}
      {!ach.unlocked && (
        <div className="absolute top-2 right-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
      )}

      {/* Icon */}
      <div className={cn('text-3xl w-12 h-12 flex items-center justify-center rounded-full', ach.unlocked ? 'bg-primary/10' : 'bg-muted/50 grayscale')}>
        {ach.icon}
      </div>

      {/* Text */}
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm">{ach.title}</p>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', rs.badge)}>
            {rs.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ach.description}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
          <span>
            {ach.unlocked
              ? completedDate
                ? `Completed on ${completedDate}`
                : 'Completed! 🎉'
              : ach.nudgeText || ach.howToReach}
          </span>
          <span className="font-semibold">{ach.progress}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700',
              ach.unlocked ? 'bg-green-500' :
                ach.rarity === 'LEGENDARY' ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                  ach.rarity === 'EPIC' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                    ach.rarity === 'RARE' ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
                      'bg-primary'
            )}
            style={{ width: `${ach.progress}%` }}
          />
        </div>
        {!ach.unlocked && (
          <p className="text-[10px] text-muted-foreground">+{ach.xpReward} XP on unlock</p>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const CreditsPage = () => {
  const { isSignedIn } = useAuthState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sliderRef = useRef<HTMLDivElement>(null);

  const [selectedPayment, setSelectedPayment] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(2);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [celebrationAch, setCelebrationAch] = useState<AchievementData | null>(null);
  const [seenUnlocked, setSeenUnlocked] = useState<Set<string>>(new Set());

  const [isRefreshing, setIsRefreshing] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return !!urlParams.get('refresh');
  });

  useEffect(() => {
    if (!isSignedIn) { navigate('/signin'); return; }
    if (isRefreshing) {
      window.history.replaceState({}, '', '/dashboard/credits');
      queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
      queryClient.invalidateQueries({ queryKey: ['credits-history'] });
      queryClient.invalidateQueries({ queryKey: ['credits-eligibility'] });
      const t = setTimeout(() => setIsRefreshing(false), 5000);
      return () => clearTimeout(t);
    }
  }, [isSignedIn, navigate, queryClient, isRefreshing]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['credits-balance'],
    queryFn: () => apiRequest<{ success: boolean; data: CreditBalance }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/balance`).then(r => r.data),
    enabled: isSignedIn,
    refetchInterval: isRefreshing ? 1000 : false,
  });

  const { data: eligibilityData } = useQuery({
    queryKey: ['credits-eligibility'],
    queryFn: () => apiRequest<{ success: boolean; data: { canClaimFreeCredits: boolean; hasClaimedFreeCredits: boolean; phoneVerified: boolean } }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/check-eligibility`).then(r => r.data),
    enabled: isSignedIn,
    refetchInterval: isRefreshing ? 1000 : false,
  });

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['credit-plans'],
    queryFn: () => apiRequest<{ success: boolean; plans: CreditPlan[] }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/plans`).then(r => r.plans),
    staleTime: 1000 * 60 * 60,
  });

  const { data: gamData, isLoading: gamLoading, refetch: refetchGam } = useQuery({
    queryKey: ['gamification'],
    queryFn: () => apiRequest<{ success: boolean; data: GamificationStatus }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/gamification/status`).then(r => r.data),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const { data: historyData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: historyLoading } = useInfiniteQuery({
    queryKey: ['credits-history'],
    queryFn: async ({ pageParam = 0 }) => {
      const r = await apiRequest<{ success: boolean; data: CreditHistory }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/history?limit=20&offset=${pageParam}`);
      return r.data;
    },
    initialPageParam: 0,
    getNextPageParam: (last) => { const next = last.offset + last.limit; return next < last.total ? next : undefined; },
    enabled: isSignedIn,
    refetchInterval: isRefreshing ? 1000 : false,
  });

  // Daily check-in mutation — idempotent on server
  const checkinMutation = useMutation({
    mutationFn: () => apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/gamification/daily-checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gamification'] }); },
  });

  // Fire check-in on mount (server is idempotent — safe to always call)
  useEffect(() => {
    if (isSignedIn) { checkinMutation.mutate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Show confetti for newly unlocked achievements
  useEffect(() => {
    if (!gamData?.newlyUnlocked?.length) return;
    const notYetSeen = gamData.newlyUnlocked.filter(k => !seenUnlocked.has(k));
    if (!notYetSeen.length) return;
    const key = notYetSeen[0];
    const ach = (gamData.achievements ?? []).find(a => a.achievementKey === key);
    if (ach) setCelebrationAch(ach);
    setSeenUnlocked(prev => { const s = new Set(prev); notYetSeen.forEach(k => s.add(k)); return s; });
    // We intentionally only trigger when newlyUnlocked changes; seenUnlocked via functional update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamData?.newlyUnlocked]);

  const transactions = historyData?.pages.flatMap(p => p.transactions) || [];
  const allActivePlans = plansData || [];
  const plans = allActivePlans.filter(p => p.amount > 0);
  const selectedPlan = plans[Math.min(selectedPlanIndex, plans.length - 1)];

  const gam = gamData;

  // ── Purchase ─────────────────────────────────────────────────────────────────

  const handlePurchase = useCallback(async () => {
    if (!selectedPlan || isPurchasing) return;
    setIsPurchasing(true);
    try {
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.body.appendChild(script);
        });
      }
      const orderData = await apiRequest<{ success: boolean; order: { id: string; amount: number; currency: string; key: string }; plan: { id: string; name: string; credits: number }; serverAmount: number }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/payments/create-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: selectedPlan.planId }) });
      const rzp = new window.Razorpay({
        key: orderData.order.key, amount: orderData.order.amount, currency: orderData.order.currency,
        name: 'FairArena', description: `${orderData.plan.credits} Credits`,
        order_id: orderData.order.id, theme: { color: '#6366f1' },
        handler: async (response: Record<string, unknown>) => {
          try {
            await apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/payments/verify-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature }) });
            toast.success('Payment successful! Credits added 🎉');
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
              queryClient.invalidateQueries({ queryKey: ['credits-history'] });
              queryClient.invalidateQueries({ queryKey: ['gamification'] });
            }, 3000);
          } catch { toast.error('Payment verification failed. Contact support.'); }
        },
      });
      rzp.on('payment.failed', () => toast.error('Payment failed. Please try again.'));
      rzp.open();
    } catch { toast.error('Failed to initiate payment. Please try again.'); }
    finally { setIsPurchasing(false); }
  }, [selectedPlan, isPurchasing, queryClient]);

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) { toast.error('Please enter a coupon code'); return; }
    setIsRedeeming(true);
    try {
      const result = await apiRequest<{ success: boolean; message: string; data: { success: boolean; credits: number; planId?: string; durationDays?: number } }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/coupons/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: couponCode }) });
      if (result.success) {
        toast.success(result.message || 'Coupon redeemed successfully!');
        setCouponCode('');
        queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
        queryClient.invalidateQueries({ queryKey: ['credits-history'] });
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
        if (result.data.planId) queryClient.invalidateQueries({ queryKey: ['user-subscription'] });
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to redeem coupon');
    } finally { setIsRedeeming(false); }
  };

  const fetchPaymentDetails = useCallback((transaction: CreditTransaction) => {
    if (!transaction.payment) return;
    setSelectedPayment({ id: transaction.id, razorpayOrderId: transaction.payment.razorpayOrderId, razorpayPaymentId: transaction.payment.razorpayPaymentId, planName: transaction.payment.planName, amount: transaction.payment.amount, currency: 'INR', credits: Math.abs(transaction.amount), status: transaction.payment.status, createdAt: transaction.createdAt });
    setShowPaymentDialog(true);
  }, []);

  const getTransactionIcon = (type: string, amount: number) => {
    switch (type) {
      case 'PURCHASE': return <CreditCard className="h-4 w-4" />;
      case 'REFUND': return <RefreshCw className="h-4 w-4" />;
      case 'BONUS': return <Gift className="h-4 w-4" />;
      case 'COUPON_REDEMPTION': return <TicketIcon className="h-4 w-4" />;
      case 'DEDUCTION': return <TrendingDown className="h-4 w-4" />;
      default: return amount > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
    }
  };

  if (!isSignedIn) return null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">

      {/* Confetti celebration overlay */}
      {celebrationAch && (
        <ConfettiOverlay achievement={celebrationAch} onDone={() => setCelebrationAch(null)} />
      )}

      <div className="max-w-6xl mx-auto space-y-10">

        {/* ── Hero Header ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-950/60 via-background to-purple-950/40 p-6 sm:p-8">
          <div className="absolute inset-0 bg-grid-white/[0.03] pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">Credits</h1>
                {gam && (
                  <>
                    <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs font-bold">
                      <Star className="h-3 w-3 mr-1" /> Lv {gam.level}
                    </Badge>
                    <Badge className={cn('text-xs font-bold border-0 bg-gradient-to-r text-white', TIER_COLORS[gam.tier.key] ?? 'from-amber-700 to-amber-500')}>
                      {gam.tier.label} Tier
                    </Badge>
                  </>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                {balanceLoading ? <Skeleton className="h-12 w-32" /> : (
                  <>
                    <span className="text-5xl font-bold tracking-tight">{balanceData?.balance.toLocaleString() ?? '0'}</span>
                    <span className="text-xl text-muted-foreground">credits</span>
                  </>
                )}
              </div>
              {gam && (
                <div className="space-y-1 max-w-xs">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>XP: {gam.xp.toLocaleString()}</span>
                    <span>{gam.xpToNextLevel > 0 ? `${gam.xpToNextLevel} to Level ${gam.level + 1}` : 'Max Level!'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700" style={{ width: `${gam.levelProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button onClick={() => navigate('/dashboard/subscription')} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0">
                <Sparkles className="h-4 w-4 mr-2" /> Upgrade Plan
              </Button>
              <Button onClick={() => { refetchGam(); toast.info('Stats refreshed'); }} variant="outline" size="sm">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync Stats
              </Button>
            </div>
          </div>
        </div>

        {/* ── Daily Streak + Tier Progress ─────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">

          {/* Daily Streak */}
          <Card className="border bg-gradient-to-br from-orange-500/10 to-red-500/5 overflow-hidden">
            <CardContent className="p-5">
              {gamLoading ? <Skeleton className="h-20 w-full" /> : (
                <div className="flex items-center gap-4">
                  <div className="text-5xl">{(gam?.loginStreak ?? 0) >= 7 ? '🔥' : (gam?.loginStreak ?? 0) >= 3 ? '🌟' : '⚡'}</div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{gam?.loginStreak ?? 0}</span>
                      <span className="text-muted-foreground text-sm">day streak</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {gam?.checkedInToday
                        ? '✅ Checked in today! Come back tomorrow to keep it going.'
                        : '⏰ Check in today to continue your streak!'}
                    </p>
                    {(gam?.longestStreak ?? 0) > 0 && (
                      <p className="text-xs text-orange-400/80 mt-1">🏆 Best: {gam?.longestStreak} days</p>
                    )}
                  </div>
                  {gam?.checkedInToday && (
                    <Badge className="bg-green-500/20 text-green-400 text-xs border-green-500/30">+10 XP</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Spending Tier */}
          <Card className="border overflow-hidden">
            <CardContent className="p-5">
              {gamLoading ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="font-semibold text-sm">Spending Tier</span>
                    </div>
                    <Badge className={cn('text-xs font-bold border-0 bg-gradient-to-r text-white', TIER_COLORS[gam?.tier.key ?? 'bronze'])}>
                      {gam?.tier.label ?? 'Bronze'}
                    </Badge>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700 bg-gradient-to-r', TIER_COLORS[gam?.tier.key ?? 'bronze'])}
                      style={{ width: `${gam?.tierProgress ?? 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{gam?.tierProgress ?? 0}%</span>
                    {gam && gam.nextTierAmountNeeded > 0 ? (
                      <span className="text-yellow-500/90 font-medium">
                        Spend ₹{Math.ceil(gam.nextTierAmountNeeded / 100)} more → <strong>{gam.nextTierLabel}</strong> 🚀
                      </span>
                    ) : <span>🏆 Max Tier Reached!</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Free Credits / Phone Verify ──────────────────────────────────────── */}
        {eligibilityData && !eligibilityData.hasClaimedFreeCredits && (
          <Card className="border bg-indigo-500/5 border-indigo-500/20">
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-indigo-500/15 rounded-full"><Gift className="h-6 w-6 text-indigo-400" /></div>
                <div>
                  <h3 className="font-semibold">Claim Free Credits</h3>
                  <p className="text-muted-foreground text-sm">
                    {eligibilityData.phoneVerified
                      ? 'Claim your 200 free credits and unlock the Verified Hero achievement!'
                      : 'Verify your phone to claim 200 free credits and unlock the Verified Hero achievement!'}
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate('/dashboard/credits/verify')} className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white">
                {eligibilityData.phoneVerified ? 'Claim Now' : 'Verify & Claim'} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Buy Credits Slider ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Buy Credits</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Drag the slider to choose • credits never expire</p>
            </div>
            <Badge variant="secondary" className="text-xs"><Zap className="h-3 w-3 mr-1" /> Never Expire</Badge>
          </div>
          <Card className="border shadow-sm overflow-hidden">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {plansLoading ? (
                <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold tracking-tight">{selectedPlan?.credits.toLocaleString()}</span>
                        <span className="text-xl text-muted-foreground font-medium">credits</span>
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">{selectedPlan?.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-bold">₹{((selectedPlan?.amount || 0) / 100).toLocaleString('en-IN')}</div>
                      <div className="text-sm text-muted-foreground">₹{(((selectedPlan?.amount || 0) / 100) / (selectedPlan?.credits || 1)).toFixed(2)} per credit</div>
                    </div>
                  </div>
                  <div ref={sliderRef} className="space-y-3">
                    <Slider min={0} max={plans.length - 1} step={1} value={[selectedPlanIndex]} onValueChange={([val]) => setSelectedPlanIndex(val)} className="w-full" />
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                      {plans.map((plan, i) => (
                        <button key={plan.planId} onClick={() => setSelectedPlanIndex(i)} className={cn('transition-colors font-medium', i === selectedPlanIndex ? 'text-foreground' : 'hover:text-foreground/70')}>
                          {plan.credits >= 1000 ? `${plan.credits / 1000}k` : plan.credits}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedPlan?.features && selectedPlan.features.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedPlan.features.map(f => (
                        <div key={f} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span className="text-muted-foreground">{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button onClick={handlePurchase} disabled={isPurchasing || !selectedPlan} className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0" size="lg">
                    {isPurchasing ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Plus className="mr-2 h-4 w-4" />Buy {selectedPlan?.credits.toLocaleString()} Credits for ₹{((selectedPlan?.amount || 0) / 100).toLocaleString('en-IN')}</>}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">Secured by Razorpay · Credits are non-refundable after use</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Subscription Upsell ──────────────────────────────────────────────── */}
        <Card className="border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/5">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-indigo-500/15"><Sparkles className="h-6 w-6 text-indigo-400" /></div>
              <div>
                <h3 className="font-bold text-lg">Unlock Subscriber Perks</h3>
                <p className="text-muted-foreground text-sm">Get monthly credits, the <strong>Subscriber ⭐</strong> achievement badge, +100 XP, and priority support.</p>
              </div>
            </div>
            <Button onClick={() => navigate('/dashboard/subscription')} className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white">
              View Plans <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* ── Achievements ─────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" /> Achievements
              </h2>
              {gam && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {gam.achievements.filter(a => a.unlocked).length} / {gam.achievements.length} unlocked
                </p>
              )}
            </div>
          </div>

          {/* "You're so close!" nudge */}
          {gam?.closestLocked && (
            <Card className="border border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="text-2xl">{gam.closestLocked.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">You're <span className="text-yellow-400">{gam.closestLocked.progress}%</span> toward <span className="text-yellow-400">{gam.closestLocked.title}</span>!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{gam.closestLocked.nudgeText} to unlock it and earn +{gam.closestLocked.xpReward} XP 🔥</p>
                </div>
                <div className="h-10 w-10 shrink-0">
                  <svg viewBox="0 0 36 36" className="rotate-[-90deg]">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400" strokeDasharray={`${gam.closestLocked.progress} ${100 - gam.closestLocked.progress}`} strokeLinecap="round" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          )}

          {gamLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : gam?.achievements.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {gam.achievements.map(a => <AchievementCard key={a.id} ach={a} />)}
            </div>
          ) : (
            <Card className="border shadow-none">
              <CardContent className="p-8 text-center text-muted-foreground">No achievements found — contact support if this persists.</CardContent>
            </Card>
          )}
        </div>

        {/* ── Coupon Redemption ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Redeem Coupon</h2>
          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input placeholder="Enter coupon code (e.g. WELCOME200)" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} className="h-12 uppercase" disabled={isRedeeming} />
                  <p className="text-xs text-muted-foreground mt-2">Enter a valid coupon code to get credits or premium subscriptions.</p>
                </div>
                <Button onClick={handleRedeemCoupon} disabled={isRedeeming || !couponCode.trim()} className="h-12 px-8 font-semibold" variant="secondary">
                  {isRedeeming ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Redeeming...</> : <><TicketIcon className="mr-2 h-4 w-4" />Redeem</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Enterprise CTA ───────────────────────────────────────────────────── */}
        <Card className="border-2 border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-rose-500/10"><Crown className="h-6 w-6 text-rose-500" /></div>
              <div>
                <h4 className="font-bold text-lg">Enterprise Plan</h4>
                <p className="text-muted-foreground text-sm mt-0.5">Unlimited credits, dedicated support &amp; custom integrations</p>
              </div>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-2 shrink-0">
              <div className="text-2xl font-bold">Custom Pricing</div>
              <Button variant="outline" className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500" onClick={() => window.open('mailto:contact@fairarena.app?subject=Enterprise Plan Inquiry', '_blank')}>
                Contact Us <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Transaction History ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">History</h2>
          <Card className="border shadow-none">
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-muted inline-flex p-4 rounded-full mb-4"><History className="h-8 w-8 text-muted-foreground" /></div>
                  <h3 className="text-lg font-medium">No transactions yet</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm mx-auto">When you purchase or use credits, they will appear here.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {transactions.map(t => (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 hover:bg-muted/50 transition-colors gap-4" role={t.type === 'PURCHASE' ? 'button' : undefined} onClick={() => t.type === 'PURCHASE' && t.payment && fetchPaymentDetails(t)}>
                      <div className="flex items-start gap-4 min-w-0">
                        <div className={cn('mt-1 p-2 rounded-full bg-secondary shrink-0', t.type === 'PURCHASE' ? 'text-green-600 dark:text-green-500' : t.type === 'DEDUCTION' ? 'text-red-600 dark:text-red-500' : 'text-foreground')}>
                          {getTransactionIcon(t.type, t.amount)}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate pr-2">{t.description}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                            <span className="hidden sm:inline">•</span>
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal uppercase tracking-wider">{t.type.replace('_', ' ')}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right pl-[52px] sm:pl-0">
                        <span className={cn('font-semibold block', t.amount > 0 ? 'text-green-600 dark:text-green-500' : 'text-foreground')}>
                          {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">Bal: {t.balance.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {hasNextPage && (
              <div className="p-4 border-t text-center">
                <Button variant="ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? 'Loading...' : 'Load more transactions'}
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <div className="flex gap-4">
            <Link to="/terms-and-conditions" className="hover:underline">Terms</Link>
            <Link to="/privacy-policy" className="hover:underline">Privacy</Link>
            <Link to="/refund" className="hover:underline">Refunds</Link>
          </div>
          <div className="flex items-center gap-2"><Shield className="h-3 w-3" /><span>Secured by Razorpay</span></div>
        </div>

        {/* Payment Details Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>Receipt for credit purchase</DialogDescription>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4 pt-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={selectedPayment.status === 'captured' ? 'default' : 'secondary'}>{selectedPayment.status}</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">₹{selectedPayment.amount / 100}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Credits</span>
                    <span className="font-semibold">{selectedPayment.credits}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span>{new Date(selectedPayment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="border-t pt-3 mt-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Order ID</span>
                      <span className="font-mono truncate max-w-[200px]">{selectedPayment.razorpayOrderId}</span>
                    </div>
                  </div>
                </div>
                {selectedPayment.invoiceUrl && (
                  <Button onClick={() => window.open(selectedPayment.invoiceUrl, '_blank')} className="w-full" variant="outline">
                    <ExternalLink className="mr-2 h-4 w-4" /> Download Invoice
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default CreditsPage;
