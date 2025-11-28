import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@clerk/clerk-react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Info,
  Loader2,
  Mail,
  Shield,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Log {
  id: string;
  action: string;
  level: 'INFO' | 'WARN' | 'CRITICAL';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export default function AccountLogs() {
  const [isVerified, setIsVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [message, setMessage] = useState('');
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const { getToken } = useAuth();

  const checkVerificationStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/status`,
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
          credentials: 'include',
        },
      );
      const data = await res.json();
      if (data.success && data.verified) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
    } catch (error) {
      console.error('Verification check failed:', error);
      setIsVerified(false);
    }
  }, [getToken]);

  useEffect(() => {
    checkVerificationStatus();
  }, [checkVerificationStatus]);

  // Countdown timer for rate limiting
  useEffect(() => {
    let interval: number;
    if (isRateLimited && retryAfter > 0) {
      interval = setInterval(() => {
        setRetryAfter((prev) => {
          if (prev <= 1) {
            setIsRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRateLimited, retryAfter]);

  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/logs`, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      } else {
        setMessage('Failed to fetch logs');
      }
    } catch (error) {
      console.error('Fetch logs failed:', error);
      setMessage('Failed to fetch logs');
    } finally {
      setIsLoadingLogs(false);
    }
  }, [getToken]);

  // Fetch logs when verified
  useEffect(() => {
    if (isVerified) {
      fetchLogs();
    }
  }, [isVerified, fetchLogs]);

  const sendOtp = async () => {
    setIsSendingOtp(true);
    setMessage('');
    setIsRateLimited(false);
    setRetryAfter(0);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/send-otp`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
          credentials: 'include',
        },
      );
      const data = await res.json();
      if (res.status === 429) {
        // Rate limited
        setIsRateLimited(true);
        setRetryAfter(data.retryAfter || 1800); // Default to 30 minutes
        setMessage(data.message || 'Too many OTP requests. Please try again later.');
      } else if (data.success) {
        setMessage('OTP sent to your email successfully!');
        setIsRateLimited(false);
        setRetryAfter(0);
      } else {
        setMessage(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP failed:', error);
      setMessage('Failed to send OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      setMessage('Please enter the OTP');
      return;
    }
    setIsVerifyingOtp(true);
    setMessage('');
    setIsRateLimited(false);
    setRetryAfter(0);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${await getToken()}`,
          },
          body: JSON.stringify({ otp }),
          credentials: 'include',
        },
      );
      const data = await res.json();

      if (res.status === 429) {
        // Rate limited
        setIsRateLimited(true);
        setRetryAfter(data.retryAfter || 900); // Default to 15 minutes
        setMessage(data.message || 'Too many attempts. Please try again later.');
      } else if (data.success) {
        setIsVerified(true);
        setMessage('Verification successful!');
        setOtp('');
        setIsRateLimited(false);
        setRetryAfter(0);
      } else {
        setMessage(data.message || 'Verification failed');
      }
    } catch (error) {
      console.error('Verify OTP failed:', error);
      setMessage('Verification failed');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center space-x-2">
          <Shield className="h-8 w-8" />
          <span>Account Settings</span>
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {isVerified ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span>Account Verification</span>
            </CardTitle>
            <CardDescription>
              Verify your account to access sensitive settings. Verification expires in 10 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Verification Status:</span>
              <Badge variant={isVerified ? 'default' : 'destructive'}>
                {isVerified ? 'Verified' : 'Not Verified'}
              </Badge>
            </div>

            {!isVerified && (
              <>
                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium">
                    Enter OTP
                  </label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    disabled={isRateLimited}
                  />
                  {isRateLimited && retryAfter > 0 && (
                    <div className="text-sm text-orange-600">
                      Too many attempts. Try again in {Math.ceil(retryAfter / 60)} minutes.
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={sendOtp}
                    disabled={isSendingOtp || isRateLimited}
                    variant="outline"
                    className="flex-1"
                  >
                    {isSendingOtp ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : isRateLimited ? (
                      <XCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    {isSendingOtp ? 'Sending...' : isRateLimited ? 'Rate Limited' : 'Send OTP'}
                  </Button>
                  <Button
                    onClick={verifyOtp}
                    disabled={isVerifyingOtp || !otp.trim() || isRateLimited}
                    className="flex-1"
                  >
                    {isVerifyingOtp ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    {isVerifyingOtp ? 'Verifying...' : 'Verify'}
                  </Button>
                </div>
              </>
            )}

            {message && (
              <div
                className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}
              >
                {message}
              </div>
            )}

            {isVerified && (
              <div className="text-sm text-muted-foreground">
                You are verified. You can now access and modify your account settings.
              </div>
            )}
          </CardContent>
        </Card>

        {isVerified && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Account Logs</span>
              </CardTitle>
              <CardDescription>Your recent account activity and security events. Retained till 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Levels</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARN">Warning</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading logs...</span>
                </div>
              ) : (
                (() => {
                  const filteredLogs = logs.filter((log) => {
                    const matchesSearch = log.action
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase());
                    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
                    return matchesSearch && matchesLevel;
                  });

                  return filteredLogs.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredLogs.map((log) => {
                        const getLevelIcon = (level: string) => {
                          switch (level) {
                            case 'CRITICAL':
                              return <AlertCircle className="h-4 w-4 text-red-500" />;
                            case 'WARN':
                              return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
                            default:
                              return <Info className="h-4 w-4 text-blue-500" />;
                          }
                        };

                        const getLevelColor = (level: string) => {
                          switch (level) {
                            case 'CRITICAL':
                              return 'bg-red-100 text-red-800 border-red-200';
                            case 'WARN':
                              return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                            default:
                              return 'bg-blue-100 text-blue-800 border-blue-200';
                          }
                        };

                        return (
                          <div
                            key={log.id}
                            className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start space-x-3 flex-1">
                              {getLevelIcon(log.level)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-medium text-sm">{log.action}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs px-2 py-0.5 ${getLevelColor(log.level)}`}
                                  >
                                    {log.level}
                                  </Badge>
                                </div>
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {Object.entries(log.metadata).map(([key, value]) => (
                                      <span key={key} className="mr-3">
                                        <strong>{key}:</strong> {String(value)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {logs.length === 0 ? 'No logs found.' : 'No logs match your filters.'}
                      </p>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
