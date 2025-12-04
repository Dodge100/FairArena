import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@clerk/clerk-react';
import {
  AlertCircle,
  CreditCard,
  Gift,
  History,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
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

const CreditsPage = () => {
  const { userId, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [history, setHistory] = useState<CreditHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
        return <CreditCard className="h-4 w-4 text-green-500" />;
      case 'REFUND':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'BONUS':
        return <Gift className="h-4 w-4 text-purple-500" />;
      case 'DEDUCTION':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return amount > 0 ? (
          <TrendingUp className="h-4 w-4 text-green-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        );
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    switch (type) {
      case 'PURCHASE':
        return 'text-green-600';
      case 'REFUND':
        return 'text-blue-600';
      case 'BONUS':
        return 'text-purple-600';
      case 'DEDUCTION':
        return 'text-red-600';
      default:
        return amount > 0 ? 'text-green-600' : 'text-red-600';
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

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Credits</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your hackathon credits and view transaction history
          </p>
        </div>

        {/* Credit Balance Card */}
        <Card className="mb-8 border-2 border-[#d9ff00]/20 bg-linear-to-r from-[#d9ff00]/5 to-[#d9ff00]/10">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                  Current Balance
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Available credits for hackathons
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-[#d9ff00] mb-1">
                  {loading ? (
                    <Skeleton className="h-10 w-24" />
                  ) : (
                    balance?.balance.toLocaleString() || '0'
                  )}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Credits</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={() => navigate('/dashboard#pricing')}
                className="bg-[#d9ff00] text-black hover:bg-[#c0e600] font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Buy Credits
              </Button>
              <Button variant="outline" onClick={fetchCreditBalance} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <CardTitle className="text-xl">Transaction History</CardTitle>
            </div>
            <CardDescription>View all your credit transactions and purchases</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading && !history ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
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
                <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  No transactions yet
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Your credit transaction history will appear here once you make purchases or use
                  credits.
                </p>
                <Button
                  onClick={() => navigate('/dashboard#pricing')}
                  className="bg-[#d9ff00] text-black hover:bg-[#c0e600]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Get Started with Credits
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {history?.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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
                        className={`font-semibold ${getTransactionColor(transaction.type, transaction.amount)}`}
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

                {/* Load More Button */}
                {history && history.transactions.length < history.total && (
                  <div className="text-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => fetchCreditHistory(true)}
                      disabled={loadingMore}
                      className="w-full sm:w-auto"
                    >
                      {loadingMore ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Load More Transactions
                          <span className="ml-2 text-sm text-slate-500">
                            ({history.transactions.length} of {history.total})
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Tips */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">How Credits Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Earning Credits
                </h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• Purchase credit packages from our pricing plans</li>
                  <li>• Receive bonus credits for referrals</li>
                  <li>• Get promotional credits during special events</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Using Credits</h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• Credits are used when creating hackathons</li>
                  <li>• Each participant in your hackathon costs credits</li>
                  <li>• Unused credits don't expire</li>
                </ul>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Need more credits? Check out our pricing plans.
              </p>
              <Button
                onClick={() => navigate('/dashboard#pricing')}
                variant="outline"
                className="border-[#d9ff00] text-[#d9ff00] hover:bg-[#d9ff00] hover:text-black"
              >
                View Pricing Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreditsPage;
