import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  CreditCard,
  ExternalLink,
  Gift,
  History,
  Plus,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthState } from '../lib/auth';

interface CreditBalance {
  balance: number;
  userId: string;
}

interface CreditTransaction {
  id: string;
  amount: number;
  balance: number;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  payment?: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    planName: string;
    amount: number;
    status: string;
  };
}

interface CreditHistory {
  transactions: CreditTransaction[];
  total: number;
  limit: number;
  offset: number;
}

interface PaymentDetails {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  planName: string;
  amount: number;
  currency: string;
  credits: number;
  status: string;
  createdAt: string;
  completedAt?: string;
  invoiceUrl?: string;
}

const CreditsPage = () => {
  const { isSignedIn, getToken } = useAuthState();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [history, setHistory] = useState<CreditHistory | null>(null);
  // Use ref to track history without adding it to dependency arrays prevents infinite loops
  const historyRef = useRef<CreditHistory | null>(null);

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [userEligibility, setUserEligibility] = useState<{
    canClaimFreeCredits: boolean;
    hasClaimedFreeCredits: boolean;
    phoneVerified: boolean;
  } | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const fetchCreditHistory = useCallback(
    async (loadMore = false) => {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setHistoryLoading(true);
      }

      try {
        const offset = loadMore && historyRef.current ? historyRef.current.offset + historyRef.current.limit : 0;
        const token = await getToken();
        if (!token) return;

        const cacheBuster = Date.now();
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/history?limit=20&offset=${offset}&_=${cacheBuster}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
            cache: 'no-store',
          },
        );

        if (response.status === 429) {
          toast.error("You are checking history too frequently. Please wait a moment.");
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          if (loadMore && historyRef.current) {
            setHistory({
              ...data.data,
              transactions: [...historyRef.current.transactions, ...data.data.transactions],
            });
          } else {
            setHistory(data.data);
          }
        } else {
          toast.error('Failed to load credit history');
        }
      } catch (error) {
        console.error('Error fetching credit history:', error);
        toast.error('Failed to load credit history');
      } finally {
        setLoadingMore(false);
        setHistoryLoading(false);
        setLoading(false);
      }
    },
    [getToken], // Removed history from dependencies
  );

  const fetchCreditBalance = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const cacheBuster = Date.now();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/balance?_=${cacheBuster}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.status === 429) return;

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setBalance(data.data);
      } else {
        toast.error('Failed to load credit balance');
      }
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      toast.error('Failed to load credit balance');
    }
  }, [getToken]);

  const checkUserEligibility = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const cacheBuster = Date.now();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/check-eligibility?_=${cacheBuster}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserEligibility(data.data);
        }
      }
    } catch (error) {
      console.error('Error checking user eligibility:', error);
    }
  }, [getToken]);

  const fetchPaymentDetails = useCallback(async (transaction: CreditTransaction) => {
    if (!transaction.payment) return;

    try {
      const paymentDetails: PaymentDetails = {
        id: transaction.id,
        razorpayOrderId: transaction.payment.razorpayOrderId,
        razorpayPaymentId: transaction.payment.razorpayPaymentId,
        planName: transaction.payment.planName,
        amount: transaction.payment.amount,
        currency: 'INR',
        credits: Math.abs(transaction.amount),
        status: transaction.payment.status,
        createdAt: transaction.createdAt,
      };

      setSelectedPayment(paymentDetails);
      setShowPaymentDialog(true);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      toast.error('Failed to load payment details');
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      navigate('/signin');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const shouldRefresh = urlParams.get('refresh');

    if (shouldRefresh) {
      window.history.replaceState({}, '', '/dashboard/credits');
      setTimeout(() => {
        setLoading(true);
        Promise.all([
          fetchCreditBalance(),
          fetchCreditHistory(),
          checkUserEligibility()
        ]).finally(() => setLoading(false));
      }, 500);
    } else {
      fetchCreditBalance();
      fetchCreditHistory();
      checkUserEligibility();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, navigate]); // Removed fetch functions from dep array to be extra safe, though useCallback fix should handle it.

  const getTransactionIcon = (type: string, amount: number) => {
    switch (type) {
      case 'PURCHASE':
        return <CreditCard className="h-4 w-4" />;
      case 'REFUND':
        return <RefreshCw className="h-4 w-4" />;
      case 'BONUS':
        return <Gift className="h-4 w-4" />;
      case 'DEDUCTION':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return amount > 0 ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        );
    }
  };

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Credits</h1>
            <p className="text-muted-foreground max-w-2xl">
              Manage your balance and transaction history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => window.location.hash = 'pricing'}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Buy Credits
            </Button>
          </div>
        </div>

        {/* Balance Section */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1 border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight">
                {loading ? (
                  <Skeleton className="h-10 w-24" />
                ) : (
                  balance?.balance.toLocaleString() || '0'
                )}
                <span className="text-lg font-normal text-muted-foreground ml-2">credits</span>
              </div>
            </CardContent>
          </Card>

          {/* Promotional cards / Actions */}
          <div className="md:col-span-2 space-y-4">
            {userEligibility !== null && userEligibility?.canClaimFreeCredits && (
              <Card className="border bg-secondary/30 shadow-none">
                <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Gift className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Claim Free Credits</h3>
                      <p className="text-muted-foreground text-sm">Verify your phone to verify your account and get 200 free credits.</p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/dashboard/credits/verify')} variant="outline" className="w-full sm:w-auto shrink-0">
                    Claim Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {userEligibility !== null && !userEligibility?.hasClaimedFreeCredits && !userEligibility?.canClaimFreeCredits && (
              <Card className="border bg-secondary/30 shadow-none">
                <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Verify & Earn</h3>
                      <p className="text-muted-foreground text-sm">Secure your account with phone verification and earn 200 credits.</p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/dashboard/credits/verify')} variant="outline" className="w-full sm:w-auto shrink-0">
                    Verify Phone <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Transactions Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">History</h2>
          </div>

          <Card className="border shadow-none">
            <CardContent className="p-0">
              {historyLoading && !history ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : history?.transactions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-muted inline-flex p-4 rounded-full mb-4">
                    <History className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No transactions yet</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                    When you purchase or use credits, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {history?.transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 hover:bg-muted/50 transition-colors gap-4"
                      role={transaction.type === 'PURCHASE' ? "button" : undefined}
                      onClick={() => transaction.type === 'PURCHASE' && transaction.payment && fetchPaymentDetails(transaction)}
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className={cn("mt-1 p-2 rounded-full bg-secondary shrink-0",
                          transaction.type === 'PURCHASE' ? "text-green-600 dark:text-green-500" :
                            transaction.type === 'DEDUCTION' ? "text-red-600 dark:text-red-500" : "text-foreground"
                        )}>
                          {getTransactionIcon(transaction.type, transaction.amount)}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate pr-2">
                            {transaction.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(transaction.createdAt).toLocaleDateString()}</span>
                            <span className="hidden sm:inline">•</span>
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal uppercase tracking-wider">
                              {transaction.type.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right pl-[52px] sm:pl-0">
                        <span className={cn("font-semibold block",
                          transaction.amount > 0 ? "text-green-600 dark:text-green-500" : "text-foreground"
                        )}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Bal: {transaction.balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {history && history.transactions.length < history.total && (
              <div className="p-4 border-t text-center">
                <Button variant="ghost" onClick={() => fetchCreditHistory(true)} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load more transactions'}
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Footer Links */}
        <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <div className="flex gap-4">
            <Link to="/terms-and-conditions" className="hover:underline">Terms</Link>
            <Link to="/privacy-policy" className="hover:underline">Privacy</Link>
            <Link to="/refund" className="hover:underline">Refunds</Link>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3 w-3" />
            <span>Secured by Razorpay</span>
          </div>
        </div>

        {/* Payment Details Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
              <DialogDescription>
                Receipt for credit purchase
              </DialogDescription>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4 pt-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={selectedPayment.status === 'captured' ? 'default' : 'secondary'}>
                      {selectedPayment.status}
                    </Badge>
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
                      <span className="font-mono">{selectedPayment.razorpayOrderId}</span>
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
