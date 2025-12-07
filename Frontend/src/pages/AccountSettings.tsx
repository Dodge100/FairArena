import { ItemListModal } from '@/components/ItemListModal';
import { OTPVerification } from '@/components/OTPVerification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@clerk/clerk-react';
import { Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Report {
  id: string;
  title?: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface UserSettings {
  wantToGetFeedbackMail?: boolean;
  wantFeedbackNotifications?: boolean;
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
      } else {
        toast.error('Failed to load settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoadingSettings(false);
    }
  }, [getToken]);

  const updateSettingsValue = async (key: keyof UserSettings, value: boolean) => {
    if (!settings) return;

    const originalSettings = settings;
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    setIsSavingSettings(true);
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (data.success) {
        // Refetch settings to get the latest data
        toast.success('Settings updated successfully');
      } else {
        toast.error(data.message || 'Failed to update settings');
        setSettings(originalSettings);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
      // Revert on failure
      setSettings(originalSettings);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchReports = useCallback(async (): Promise<Report[]> => {
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/reports`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        return data.reports || [];
      } else {
        console.error('Failed to fetch reports:', data.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      return [];
    }
  }, [getToken]);

  const fetchSupportTickets = useCallback(async (): Promise<SupportTicket[]> => {
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/support`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        return data.supportTickets || [];
      } else {
        console.error('Failed to fetch support tickets:', data.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      return [];
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
        setExportMessage(
          'Data export initiated! Check your email for the download link. You will recieve an email Soon...',
        );
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

  // Fetch settings when verified
  useEffect(() => {
    if (isVerified) {
      fetchSettings();
    }
  }, [isVerified, fetchSettings]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center space-x-2">
          {/* <Shield className="h-8 w-8 " /> */}
          <span className="">Account Settings</span>
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
              <ItemListModal
                title="Your Reports"
                description="View the status of reports you've submitted."
                fetchItems={fetchReports}
                triggerText="View Reports"
                statusVariants={{
                  resolved: 'default',
                  dismissed: 'secondary',
                  escalated: 'destructive',
                  in_review: 'outline',
                }}
                statusLabels={{
                  queued: 'Queued',
                  in_review: 'In Review',
                  resolved: 'Resolved',
                  dismissed: 'Dismissed',
                  escalated: 'Escalated',
                }}
              />
            </CardContent>
          </Card>
        )}        {isVerified && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your Support Tickets</CardTitle>
              <CardDescription>View the status of support requests you've submitted.</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemListModal
                title="Your Support Tickets"
                description="View the status of support requests you've submitted."
                fetchItems={fetchSupportTickets}
                triggerText="View Support Tickets"
                statusVariants={{
                  resolved: 'default',
                  closed: 'secondary',
                  in_progress: 'outline',
                }}
                statusLabels={{
                  queued: 'Queued',
                  in_progress: 'In Progress',
                  resolved: 'Resolved',
                  closed: 'Closed',
                }}
              />
            </CardContent>
          </Card>
        )}

        {isVerified && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Messages Preferences</CardTitle>
              <CardDescription>Control how you receive and interact with messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingSettings ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Loading settings...</span>
                </div>
              ) : settings ? (
                <div className="space-y-8">
                  {/* Feedback Preferences */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        <Label htmlFor="feedback-emails" className="text-sm font-medium">
                          Weekly Feedback Emails
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Receive a weekly email asking for your feedback to help us improve
                        </p>
                      </div>
                      <Switch
                        id="feedback-emails"
                        checked={settings.wantToGetFeedbackMail || false}
                        onCheckedChange={(checked) =>
                          updateSettingsValue('wantToGetFeedbackMail', checked)
                        }
                        disabled={isSavingSettings}
                      />
                    </div>

                    {/* Feedback Notifications */}
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        <Label htmlFor="feedback-notifications" className="text-sm font-medium">
                          Weekly Feedback in-app Notifications
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Get in app notification when new feedback is available
                        </p>
                      </div>
                      <Switch
                        id="feedback-notifications"
                        checked={settings.wantFeedbackNotifications || false}
                        onCheckedChange={(checked) =>
                          updateSettingsValue('wantFeedbackNotifications', checked)
                        }
                        disabled={isSavingSettings}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Failed to load settings</p>
              )}
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
                <p>You can request a complete export of all your personal data, including:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Your profile information and settings</li>
                  <li>Account activity logs and notifications</li>
                  <li>Organization and team memberships</li>
                  <li>Project participations and roles</li>
                  <li>Social interactions (stars, follows)</li>
                  <li>Reports and feedback submitted</li>
                </ul>
                <p className="mt-2">The export will be sent to your registered email address.</p>
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
