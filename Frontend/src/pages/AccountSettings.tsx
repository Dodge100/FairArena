import { OTPVerification } from '@/components/OTPVerification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@clerk/clerk-react';
import { Download, Loader2 } from 'lucide-react';
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
  const [isExportingData, setIsExportingData] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [confirmationText, setConfirmationText] = useState('');

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

  const exportUserData = useCallback(async () => {
    // Validate confirmation text
    if (confirmationText.trim().toUpperCase() !== 'CONFIRM EXPORT MY DATA') {
      setExportMessage('Please type "CONFIRM EXPORT MY DATA" to proceed.');
      return;
    }

    setIsExportingData(true);
    setExportMessage('');
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/export-data`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        },
      );
      const data = await res.json();
      if (data.success) {
        setExportMessage('Data export initiated! Check your email for the download link. You will recieve an email Soon...');
        setConfirmationText(''); // Reset confirmation text
      } else {
        setExportMessage(data.message || 'Failed to initiate data export');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      setExportMessage('Failed to initiate data export. Please try again.');
    } finally {
      setIsExportingData(false);
    }
  }, [getToken, confirmationText]);

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

        {isVerified && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>Download all your personal data from FairArena.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  You can request a complete export of all your personal data, including:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Your profile information and settings</li>
                  <li>Account activity logs and notifications</li>
                  <li>Organization and team memberships</li>
                  <li>Project participations and roles</li>
                  <li>Social interactions (stars, follows)</li>
                  <li>Reports and feedback submitted</li>
                </ul>
                <p className="mt-2">
                  The export will be sent to your registered email address.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="confirmation" className="text-sm font-medium">
                    Confirmation Required
                  </Label>
                  <Input
                    id="confirmation"
                    type="text"
                    placeholder='Type "CONFIRM EXPORT MY DATA" to proceed'
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Please type the exact confirmation text above to proceed with the data export.
                  </p>
                </div>
              </div>

              <Button
                onClick={exportUserData}
                disabled={
                  isExportingData ||
                  confirmationText.trim().toUpperCase() !== 'CONFIRM EXPORT MY DATA'
                }
                className="w-full"
              >
                {isExportingData ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isExportingData
                  ? 'Initiating Export...'
                  : confirmationText.trim().toUpperCase() !== 'CONFIRM EXPORT MY DATA'
                    ? 'Type Confirmation Text'
                    : 'Export My Data'}
              </Button>

              {exportMessage && (
                <div
                  className={`text-sm p-3 rounded-md ${exportMessage.includes('Check your email')
                      ? 'text-green-600 bg-green-50 border border-green-200'
                      : 'text-red-600 bg-red-50 border border-red-200'
                    }`}
                >
                  {exportMessage}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
