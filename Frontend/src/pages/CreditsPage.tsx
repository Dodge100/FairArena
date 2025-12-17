import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@clerk/clerk-react';
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Gift,
  HelpCircle,
  History,
  Info,
  Plus,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const { userId, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [history, setHistory] = useState<CreditHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { getToken } = useAuth();

  const fetchCreditHistory = useCallback(
    async (loadMore = false) => {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setHistoryLoading(true);
      }

      try {
        const offset = loadMore && history ? history.offset + history.limit : 0;
        const token = await getToken();
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/history?limit=20&offset=${offset}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          if (loadMore && history) {
            setHistory({
              ...data.data,
              transactions: [...history.transactions, ...data.data.transactions],
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
    [history, getToken],
  );

  const fetchCreditBalance = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/credits/balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

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

    fetchCreditBalance();
    fetchCreditHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, userId, navigate]);

  const getTransactionIcon = (type: string, amount: number) => {
    switch (type) {
      case 'PURCHASE':
        return <CreditCard className="h-5 w-5 text-emerald-500" />;
      case 'REFUND':
        return <RefreshCw className="h-5 w-5 text-blue-500" />;
      case 'BONUS':
        return <Gift className="h-5 w-5 text-purple-500" />;
      case 'DEDUCTION':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return amount > 0 ? (
          <TrendingUp className="h-5 w-5 text-emerald-500" />
        ) : (
          <TrendingDown className="h-5 w-5 text-red-500" />
        );
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    switch (type) {
      case 'PURCHASE':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'REFUND':
        return 'text-blue-600 dark:text-blue-400';
      case 'BONUS':
        return 'text-purple-600 dark:text-purple-400';
      case 'DEDUCTION':
        return 'text-red-600 dark:text-red-400';
      default:
        return amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return 'Purchase';
      case 'REFUND':
        return 'Refund';
      case 'BONUS':
        return 'Bonus';
      case 'DEDUCTION':
        return 'Used';
      case 'ADJUSTMENT':
        return 'Adjustment';
      case 'EXPIRY':
        return 'Expired';
      case 'TRANSFER_IN':
        return 'Transfer In';
      case 'TRANSFER_OUT':
        return 'Transfer Out';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount / 100);
  };

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-linear-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent mb-4">
            Credits Dashboard
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Manage your hackathon credits, view transaction history, and purchase additional credits to fuel your innovation journey.
          </p>
        </div>

        {/* Credit Balance Card */}
        <Card className="mb-8 border-0 shadow-xl bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white overflow-hidden relative">
          <div className="absolute inset-0 bg-black/10"></div>
          <CardHeader className="pb-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold mb-2">Current Balance</CardTitle>
                <CardDescription className="text-emerald-100 text-base">
                  Available credits for creating hackathons
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-6xl font-bold mb-2">
                  {loading ? (
                    <Skeleton className="h-16 w-32 bg-white/20" />
                  ) : (
                    balance?.balance.toLocaleString() || '0'
                  )}
                </div>
                <div className="text-emerald-100 text-lg">Credits</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex flex-wrap gap-4">
              <a
                href='/dashboard/credits#pricing'
                className="bg-white text-emerald-600 hover:bg-emerald-50 font-semibold shadow-lg p-2 rounded-lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Buy More Credits
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Quick Stats */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">Total Earned</span>
                <span className="font-semibold text-emerald-600">
                  {history?.transactions
                    .filter(t => t.amount > 0)
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">Total Used</span>
                <span className="font-semibold text-red-600">
                  {history?.transactions
                    .filter(t => t.amount < 0)
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                    .toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">Transactions</span>
                <span className="font-semibold">{history?.total.toLocaleString() || '0'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  <CardTitle className="text-xl">Recent Transactions</CardTitle>
                </div>
              </div>
              <CardDescription>Your credit transaction activity</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading && !history ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-xl">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div>
                          <Skeleton className="h-4 w-32 mb-2" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-16 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : history?.transactions.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    No transactions yet
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    Your credit transaction history will appear here once you make purchases or use credits.
                  </p>
                  <Button
                    onClick={() => navigate('/dashboard#pricing')}
                    className="bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Get Started with Credits
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {history?.transactions.slice(0, 5).map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`flex items-center justify-between p-4 border rounded-xl transition-all hover:shadow-md cursor-pointer ${transaction.type === 'PURCHASE' && transaction.payment
                        ? 'hover:border-emerald-200 dark:hover:border-emerald-800'
                        : 'hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                      onClick={() => transaction.type === 'PURCHASE' && transaction.payment && fetchPaymentDetails(transaction)}
                    >
                      <div className="flex items-center gap-3">
                        {getTransactionIcon(transaction.type, transaction.amount)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {transaction.description}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${getTransactionColor(transaction.type, transaction.amount)}`}
                            >
                              {formatTransactionType(transaction.type)}
                            </Badge>
                            {transaction.type === 'PURCHASE' && transaction.payment && (
                              <Badge variant="outline" className="text-xs">
                                Click for details
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {formatDate(transaction.createdAt)}
                            {transaction.payment && (
                              <span className="ml-2">• {transaction.payment.planName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-bold text-lg ${getTransactionColor(transaction.type, transaction.amount)}`}
                        >
                          {transaction.amount > 0 ? '+' : ''}
                          {transaction.amount.toLocaleString()}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Balance: {transaction.balance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}

                  {history && history.transactions.length > 5 && (
                    <div className="text-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() => fetchCreditHistory(true)}
                        disabled={loadingMore}
                        className="w-full"
                      >
                        Load More Transactions ({history.total - history.transactions.length} remaining)
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Details Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </DialogTitle>
              <DialogDescription>
                Complete information about your credit purchase
              </DialogDescription>
            </DialogHeader>

            {selectedPayment && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Order ID</label>
                    <p className="font-mono text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded">
                      {selectedPayment.razorpayOrderId}
                    </p>
                  </div>
                  {selectedPayment.razorpayPaymentId && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Payment ID</label>
                      <p className="font-mono text-sm bg-slate-100 dark:bg-slate-800 p-2 rounded">
                        {selectedPayment.razorpayPaymentId}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Plan</label>
                    <p className="font-semibold">{selectedPayment.planName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Status</label>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedPayment.status)}
                      <span className="capitalize">{selectedPayment.status}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Amount Paid</label>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(selectedPayment.amount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Credits Received</label>
                    <p className="text-2xl font-bold text-purple-600">
                      {selectedPayment.credits.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Rate</label>
                    <p className="text-lg font-semibold">
                      ₹{(selectedPayment.amount / 100 / selectedPayment.credits).toFixed(2)}/credit
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Created</label>
                    <p>{formatDate(selectedPayment.createdAt)}</p>
                  </div>
                  {selectedPayment.completedAt && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Completed</label>
                      <p>{formatDate(selectedPayment.completedAt)}</p>
                    </div>
                  )}
                </div>

                {selectedPayment.invoiceUrl && (
                  <div className="pt-4 border-t">
                    <Button
                      onClick={() => window.open(selectedPayment.invoiceUrl, '_blank')}
                      className="w-full"
                      variant="outline"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Download Invoice
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Help & Support */}
        <Card className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800">
          <CardContent className="p-8">
            <div className="text-center">
              <HelpCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Need Help with Credits?
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
                Our support team is here to help you with any questions about credits, payments, or using the platform.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  onClick={() => window.open('mailto:fairarena.contact@gmail.com', '_blank')}
                  variant="outline"
                  size="lg"
                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Compliance Footer */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
          <div className="text-center text-sm text-slate-600 dark:text-slate-400">
            <div className="flex flex-wrap justify-center gap-6 mb-4">
              <a href="/terms-and-conditions" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Terms of Service
              </a>
              <a href="/privacy-policy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="/refund" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Refund Policy
              </a>
              <a href="/contact" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Contact Us
              </a>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-4 w-4" />
              <span>Secured by Razorpay • PCI DSS Compliant</span>
            </div>
            <p>© {new Date().getFullYear()} FairArena. All rights reserved. Credits are non-transferable and valid for 1 year from purchase date.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditsPage;
