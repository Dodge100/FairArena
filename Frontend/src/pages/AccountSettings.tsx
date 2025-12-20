import { ItemListModal } from '@/components/ItemListModal';
import { OTPVerification } from '@/components/OTPVerification';
import { SidebarCustomizationModal } from '@/components/SidebarCustomizationModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/apiClient';
import { Cookie, Download, Loader2, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CookieConsentModal } from '../components/CookieConsentModal';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useDataSaver } from '../contexts/DataSaverContext';
import { useSidebarCustomization } from '../contexts/SidebarCustomizationContext';

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
  const { dataSaverSettings, updateDataSaverSetting } = useDataSaver();
  const { consentSettings, acceptAll, rejectAll, updateConsent } = useCookieConsent();
  const { customization, resetToDefault } = useSidebarCustomization();
  const [showCookieModal, setShowCookieModal] = useState(false);
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
      const res = await apiFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/settings`);
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
  }, []);

  const updateSettingsValue = async (key: keyof UserSettings, value: boolean) => {
    if (!settings) return;

    const originalSettings = settings;
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    setIsSavingSettings(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/settings`, {
        method: 'PUT',
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

  const resetSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/settings/reset`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings reset to default successfully');
        // Refetch settings to get the latest data
        await fetchSettings();
      } else {
        toast.error(data.message || 'Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Failed to reset settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchReports = useCallback(async (): Promise<Report[]> => {
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/reports`);
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
  }, []);

  const fetchSupportTickets = useCallback(async (): Promise<SupportTicket[]> => {
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/support`);
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
  }, []);

  const exportUserData = useCallback(async () => {
    // Validate confirmation text
    if (confirmationText.trim().toUpperCase() !== 'CONFIRM EXPORT MY DATA') {
      setExportMessage('Please type "CONFIRM EXPORT MY DATA" to proceed.');
      return;
    }

    setIsExportingData(true);
    setExportMessage('');
    try {
      const res = await apiFetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/export-data`,
        {
          method: 'POST',
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
  }, [confirmationText]);

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

                    {/* Reset Settings Button */}
                    <div className="flex items-center justify-between space-x-4 pt-4 border-t">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-destructive">
                          Reset All Settings
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Reset all your preferences back to the default values
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetSettings}
                        disabled={isSavingSettings}
                        className="text-destructive hover:text-destructive"
                      >
                        {isSavingSettings ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          'Reset Settings'
                        )}
                      </Button>
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
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Sidebar Customization</span>
              </CardTitle>
              <CardDescription>
                Customize your navigation sidebar by reordering and hiding menu items
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Current Configuration</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Visible Main Items:</span>
                      <span className="ml-2 font-medium">
                        {customization.mainItems.filter(item => item.visible).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Visible Tools:</span>
                      <span className="ml-2 font-medium">
                        {customization.secondaryItems.filter(item => item.visible).length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customize Button */}
                <div className="flex items-center justify-between space-x-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">
                      Customize Sidebar Layout
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Reorder menu items, hide unwanted sections, and personalize your navigation experience
                    </p>
                  </div>
                  <SidebarCustomizationModal>
                    <Button variant="outline" className="shrink-0">
                      Customize Sidebar
                    </Button>
                  </SidebarCustomizationModal>
                </div>

                {/* Reset Option */}
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => {
                      resetToDefault();
                      toast.success('Sidebar customization reset to default');
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Reset to Default Layout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isVerified && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Data Saver Mode</span>
              </CardTitle>
              <CardDescription>
                Reduce data usage, battery consumption, and improve performance by enabling data saver features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                {/* Enable Data Saver */}
                <div className="flex items-center justify-between space-x-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="data-saver-enabled" className="text-sm font-medium">
                      Enable Data Saver
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Activate data saving features to reduce bandwidth and battery usage
                    </p>
                  </div>
                  <Switch
                    id="data-saver-enabled"
                    checked={dataSaverSettings.enabled}
                    onCheckedChange={(checked) => updateDataSaverSetting('enabled', checked)}
                  />
                </div>

                {dataSaverSettings.enabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    {/* Disable Notifications */}
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        <Label htmlFor="disable-notifications" className="text-sm font-medium">
                          Disable Notification Polling
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Stop automatic fetching of unread notification counts
                        </p>
                      </div>
                      <Switch
                        id="disable-notifications"
                        checked={dataSaverSettings.disableNotifications}
                        onCheckedChange={(checked) => updateDataSaverSetting('disableNotifications', checked)}
                      />
                    </div>

                    {/* Disable Images */}
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        <Label htmlFor="disable-images" className="text-sm font-medium">
                          Disable Image Loading
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Prevent loading of profile pictures and other images to save bandwidth
                        </p>
                      </div>
                      <Switch
                        id="disable-images"
                        checked={dataSaverSettings.disableImages}
                        onCheckedChange={(checked) => updateDataSaverSetting('disableImages', checked)}
                      />
                    </div>

                    {/* Reduce Animations */}
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        <Label htmlFor="reduce-animations" className="text-sm font-medium">
                          Reduce Animations
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Minimize motion and transitions for better performance
                        </p>
                      </div>
                      <Switch
                        id="reduce-animations"
                        checked={dataSaverSettings.reduceAnimations}
                        onCheckedChange={(checked) => updateDataSaverSetting('reduceAnimations', checked)}
                      />
                    </div>

                    {/* Disable Auto Refresh */}
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        <Label htmlFor="disable-auto-refresh" className="text-sm font-medium">
                          Disable Auto Refresh
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Stop automatic refreshing of data and feeds
                        </p>
                      </div>
                      <Switch
                        id="disable-auto-refresh"
                        checked={dataSaverSettings.disableAutoRefresh}
                        onCheckedChange={(checked) => updateDataSaverSetting('disableAutoRefresh', checked)}
                      />
                    </div>

                    {/* Force Dark Theme */}
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1">
                        <Label htmlFor="force-dark-theme" className="text-sm font-medium">
                          Force Dark Theme
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Switch to dark theme to save battery on OLED displays
                        </p>
                      </div>
                      <Switch
                        id="force-dark-theme"
                        checked={dataSaverSettings.forceDarkTheme}
                        onCheckedChange={(checked) => updateDataSaverSetting('forceDarkTheme', checked)}
                      />
                    </div>
                  </div>
                )}
              </div>
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
        {isVerified && (
          < Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cookie className="h-5 w-5" />
                <span>Cookie Preferences</span>
              </CardTitle>
              <CardDescription>
                Manage your cookie consent preferences and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Current Consent Status */}
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Current Consent Status</h4>
                  {consentSettings ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Necessary Cookies:</span>
                        <span className={`ml-2 ${consentSettings.necessary ? 'text-green-600' : 'text-red-600'}`}>
                          {consentSettings.necessary ? '✓ Accepted' : '✗ Rejected'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Analytics Cookies:</span>
                        <span className={`ml-2 ${consentSettings.analytics ? 'text-green-600' : 'text-red-600'}`}>
                          {consentSettings.analytics ? '✓ Accepted' : '✗ Rejected'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Functional Cookies:</span>
                        <span className={`ml-2 ${consentSettings.functional ? 'text-green-600' : 'text-red-600'}`}>
                          {consentSettings.functional ? '✓ Accepted' : '✗ Rejected'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Marketing Cookies:</span>
                        <span className={`ml-2 ${consentSettings.marketing ? 'text-green-600' : 'text-red-600'}`}>
                          {consentSettings.marketing ? '✓ Accepted' : '✗ Rejected'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No cookie preferences set yet. Click "Manage Preferences" to configure your cookie settings.
                    </p>
                  )}
                </div>

                {/* Manage Preferences Button */}
                <div className="flex items-center justify-between space-x-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">
                      Modify Cookie Preferences
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Review and update your cookie consent choices at any time
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowCookieModal(true)}
                    variant="outline"
                    className="shrink-0"
                  >
                    Manage Preferences
                  </Button>
                </div>

                {/* Cookie Policy Link */}
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => navigate('/cookie-policy')}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    View Detailed Cookie Policy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cookie Consent Modal */}
      <CookieConsentModal
        isOpen={showCookieModal}
        onClose={(settings) => {
          updateConsent(settings);
          setShowCookieModal(false);
        }}
        onAcceptAll={() => {
          acceptAll();
          setShowCookieModal(false);
        }}
        onRejectAll={() => {
          rejectAll();
          setShowCookieModal(false);
        }}
      />
    </div >
  );
}
