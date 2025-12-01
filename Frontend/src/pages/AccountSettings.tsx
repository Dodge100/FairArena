import { OTPVerification } from '@/components/OTPVerification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';
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
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center space-x-2">
          {/* <Shield className="h-8 w-8 " /> */}
          <span className=''>Account Settings</span>
        </h1>

        <OTPVerification onVerified={() => setIsVerified(true)} />

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
                        <Badge
                          variant={
                            report.status === 'resolved' ? 'default' :
                              report.status === 'dismissed' ? 'secondary' :
                                report.status === 'escalated' ? 'destructive' :
                                  report.status === 'in_review' ? 'outline' :
                                    'secondary'
                          }
                        >
                          {report.status === 'queued' ? 'Queued' :
                            report.status === 'in_review' ? 'In Review' :
                              report.status === 'resolved' ? 'Resolved' :
                                report.status === 'dismissed' ? 'Dismissed' :
                                  report.status === 'escalated' ? 'Escalated' :
                                    report.status}
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
