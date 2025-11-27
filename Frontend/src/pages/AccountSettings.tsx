import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@clerk/clerk-react';
import { CheckCircle, Loader2, Mail, Shield, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Report {
  id: string;
  title?: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [message, setMessage] = useState('');
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  const checkVerificationStatus = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
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
    } finally {
      setIsVerifying(false);
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

  const fetchReports = useCallback(async () => {
    setIsLoadingReports(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/reports`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        },
      );
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
      } else {
        console.error('Failed to fetch reports:', data.message);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoadingReports(false);
    }
  }, [getToken]);

  // Fetch reports when verified
  useEffect(() => {
    if (isVerified) {
      fetchReports();
    }
  }, [isVerified, fetchReports]);

  const sendOtp = async () => {
    setIsSendingOtp(true);
    setMessage('');
    setIsRateLimited(false);
    setRetryAfter(0);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/send-otp`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
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
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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

  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking verification status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center space-x-2">
          {/* <Shield className="h-8 w-8 " /> */}
          <span className=''>Account Settings</span>
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {isVerified ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className=''>Account Verification</span>
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
                    placeholder="Enter 6 to 12 digits OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={12}
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
                    variant="default"
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
              <CardTitle>Account Logs</CardTitle>
              <CardDescription>View your account activity logs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/dashboard/account-settings/logs')}>
                View Account Logs
              </Button>
            </CardContent>
          </Card>
        )}

        {isVerified && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your Reports</CardTitle>
              <CardDescription>View the status of reports you've submitted.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingReports ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Loading reports...</span>
                </div>
              ) : reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports found.</p>
              ) : (
                <div className="space-y-4">
                  {reports.map((report: Report) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{report.title || 'Report'}</h4>
                        <Badge variant={report.status === 'resolved' ? 'default' : report.status === 'pending' ? 'secondary' : 'destructive'}>
                          {report.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{report.description}</p>
                      <div className="text-xs text-muted-foreground">
                        Submitted: {new Date(report.createdAt).toLocaleDateString()}
                        {report.updatedAt && report.updatedAt !== report.createdAt && (
                          <span> • Updated: {new Date(report.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isVerified && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Manage your profile information and preferences.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Profile settings form will be implemented here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
