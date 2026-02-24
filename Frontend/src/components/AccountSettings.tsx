import { ItemListModal } from '@/components/ItemListModal';
import { SidebarCustomizationModal } from '@/components/SidebarCustomizationModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiRequest } from '@/lib/apiClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronUp,
  Cookie,
  Download,
  Layout,
  Loader2,
  Search,
  Settings,
  Shield,
  Smartphone,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CookieConsentModal } from '../components/CookieConsentModal';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useDataSaver } from '../contexts/DataSaverContext';
import { useSidebarCustomization } from '../contexts/SidebarCustomizationContext';
import { QRScannerDialog } from './auth/QRScannerDialog';

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
  fullMessage?: string;
  status: string;
  type?: string;
  severity?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserSettings {
  wantToGetFeedbackMail?: boolean;
  wantFeedbackNotifications?: boolean;
}

export default function AccountSettingsComponent() {
  const navigate = useNavigate();
  const { dataSaverSettings, updateDataSaverSetting } = useDataSaver();
  const { consentSettings, acceptAll, rejectAll, updateConsent } = useCookieConsent();
  const { customization, resetToDefault } = useSidebarCustomization();
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [disableHomePage, setDisableHomePage] = useState(
    () => localStorage.getItem('disableHomePage') === 'true',
  );

  const toggleDisableHomePage = (checked: boolean) => {
    setDisableHomePage(checked);
    localStorage.setItem('disableHomePage', String(checked));
    toast.success(`Home page ${checked ? 'disabled' : 'enabled'}`);
  };
  const queryClient = useQueryClient();

  const { data: settings = null, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['account-settings'],
    queryFn: () =>
      apiRequest<{ success: boolean; data: UserSettings }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/settings`,
      ).then((res) => res.data),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: ({ key, value }: { key: keyof UserSettings; value: boolean }) =>
      apiRequest<{ success: boolean; message?: string }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/settings`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        },
      ),
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: ['account-settings'] });
      const previousSettings = queryClient.getQueryData<UserSettings>(['account-settings']);
      if (previousSettings) {
        queryClient.setQueryData(['account-settings'], {
          ...previousSettings,
          [key]: value,
        });
      }
      return { previousSettings };
    },
    onError: (_err, _newTodo, context: { previousSettings?: UserSettings } | undefined) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['account-settings'], context.previousSettings);
      }
      toast.error('Failed to update settings');
    },
    onSuccess: () => {
      toast.success('Settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['account-settings'] });
    },
  });

  const resetSettingsMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean; message?: string }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/settings/reset`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      toast.success('Settings reset to default successfully');
      queryClient.invalidateQueries({ queryKey: ['account-settings'] });
    },
    onError: () => toast.error('Failed to reset settings'),
  });

  const exportDataMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean; message?: string }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/account-settings/export-data`,
        { method: 'POST' },
      ),
    onSuccess: (data) => {
      if (data.success) {
        setExportMessage(
          'Data export initiated! Check your email for the download link. You will recieve an email Soon...',
        );
        setConfirmationText('');
      } else {
        setExportMessage(data.message || 'Failed to initiate data export');
      }
    },
    onError: () => {
      setExportMessage('Failed to initiate data export. Please try again.');
    },
  });

  const isSavingSettings = updateSettingsMutation.isPending || resetSettingsMutation.isPending;

  const updateSettingsValue = (key: keyof UserSettings, value: boolean) => {
    if (!settings) return;
    updateSettingsMutation.mutate({ key, value });
  };

  const resetSettings = () => {
    resetSettingsMutation.mutate();
  };

  const fetchReports = useCallback(async (): Promise<Report[]> => {
    try {
      const data = await apiRequest<{ success: boolean; reports: Report[] }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/reports`,
      );
      if (data.success) {
        return data.reports || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      return [];
    }
  }, []);

  const fetchSupportTickets = useCallback(async (): Promise<SupportTicket[]> => {
    try {
      const data = await apiRequest<{ success: boolean; supportTickets: SupportTicket[] }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/support`,
      );
      if (data.success) {
        return data.supportTickets || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      return [];
    }
  }, []);

  const exportUserData = useCallback(() => {
    // Validate confirmation text
    if (confirmationText.trim().toUpperCase() !== 'CONFIRM EXPORT MY DATA') {
      setExportMessage('Please type "CONFIRM EXPORT MY DATA" to proceed.');
      return;
    }

    setExportMessage('');
    exportDataMutation.mutate();
  }, [confirmationText, exportDataMutation]);

  // Fetch settings when verified

  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<string[]>([
    'activity',
    'preferences',
    'data',
    'privacy',
  ]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  // We handle opening sections in the onChange handler to avoid setState-in-effect issues

  const sections = [
    {
      id: 'activity',
      title: 'Activity & Support',
      icon: Activity,
      description: 'View your logs, reports, and support tickets',
      keywords: ['logs', 'history', 'report', 'ticket', 'support', 'help', 'status'],
      content: (
        <div className="space-y-6">
          <Card>
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

          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Your Support Tickets</CardTitle>
              <CardDescription>
                View the status of support requests you've submitted.
              </CardDescription>
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
        </div>
      ),
    },
    {
      id: 'communication',
      title: 'Communication',
      icon: Bell,
      description: 'Manage your messages and notification preferences',
      keywords: ['email', 'feedback', 'notification', 'message', 'alert', 'communication'],
      content: (
        <Card>
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
      ),
    },
    {
      id: 'preferences',
      title: 'General Preferences',
      icon: Layout,
      description: 'Customize layout, homepage, and navigation',
      keywords: ['home', 'page', 'sidebar', 'menu', 'layout', 'navigation', 'general', 'customize'],
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>General Settings</span>
              </CardTitle>
              <CardDescription>Manage your general application preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between space-x-4">
                  <div className="flex-1">
                    <Label htmlFor="disable-home-page" className="text-sm font-medium">
                      Disable Home Page
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      If enabled, you will be redirected to the dashboard when visiting the home
                      page
                    </p>
                  </div>
                  <Switch
                    id="disable-home-page"
                    checked={disableHomePage}
                    onCheckedChange={toggleDisableHomePage}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
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
                        {customization.mainItems.filter((item) => item.visible).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Visible Tools:</span>
                      <span className="ml-2 font-medium">
                        {customization.secondaryItems.filter((item) => item.visible).length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customize Button */}
                <div className="flex items-center justify-between space-x-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Customize Sidebar Layout</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Reorder menu items, hide unwanted sections, and personalize your navigation
                      experience
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
        </div>
      ),
    },
    {
      id: 'security',
      title: 'Security',
      icon: Shield,
      description: 'Manage security settings and cross-device login',
      keywords: ['security', 'qr', 'login', 'device', 'scan', 'cross-device', 'authentication'],
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Cross-Device Login</span>
              </CardTitle>
              <CardDescription>
                Securely sign in to FairArena on another device by scanning a QR code with this
                device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">How it works</p>
                  <ol className="text-sm text-muted-foreground mt-1 space-y-1 list-decimal list-inside">
                    <li>Go to the sign-in page on another device</li>
                    <li>Choose "Sign in with QR Code"</li>
                    <li>Use this device to scan the QR code</li>
                    <li>Approve the login request</li>
                  </ol>
                </div>
              </div>
              <Button onClick={() => setShowQRScanner(true)} className="w-full">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                Scan QR Code
              </Button>
            </CardContent>
          </Card>
        </div>
      ),
    },

    {
      id: 'data',
      title: 'Data & Performance',
      icon: Smartphone,
      description: 'Manage data usage, battery settings, and exports',
      keywords: [
        'data',
        'saver',
        'battery',
        'performance',
        'bandwidth',
        'export',
        'download',
        'animations',
        'dark mode',
      ],
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Data Saver Mode</span>
              </CardTitle>
              <CardDescription>
                Reduce data usage, battery consumption, and improve performance by enabling data
                saver features
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
                        onCheckedChange={(checked) =>
                          updateDataSaverSetting('disableNotifications', checked)
                        }
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
                        onCheckedChange={(checked) =>
                          updateDataSaverSetting('disableImages', checked)
                        }
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
                        onCheckedChange={(checked) =>
                          updateDataSaverSetting('reduceAnimations', checked)
                        }
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
                        onCheckedChange={(checked) =>
                          updateDataSaverSetting('disableAutoRefresh', checked)
                        }
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
                        onCheckedChange={(checked) =>
                          updateDataSaverSetting('forceDarkTheme', checked)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
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
                  exportDataMutation.isPending ||
                  confirmationText.trim().toUpperCase() !== 'CONFIRM EXPORT MY DATA'
                }
                className="w-full"
              >
                {exportDataMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {exportDataMutation.isPending
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
        </div>
      ),
    },
    {
      id: 'privacy',
      title: 'Privacy & Legal',
      icon: Shield,
      description: 'Manage cookie consents and privacy settings',
      keywords: ['cookie', 'privacy', 'consent', 'legal', 'tracking', 'security'],
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Legal Documents</span>
              </CardTitle>
              <CardDescription>Review our terms, policies, and legal information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4 px-4"
                  onClick={() => navigate('/privacy-policy')}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-semibold">Privacy Policy</span>
                    <span className="text-xs text-muted-foreground">How we handle your data</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4 px-4"
                  onClick={() => navigate('/terms-and-conditions')}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-semibold">Terms of Service</span>
                    <span className="text-xs text-muted-foreground">Rules and regulations</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4 px-4"
                  onClick={() => navigate('/cookie-policy')}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-semibold">Cookie Policy</span>
                    <span className="text-xs text-muted-foreground">Cookie usage and tracking</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4 px-4"
                  onClick={() => navigate('/refund')}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-semibold">Refund Policy</span>
                    <span className="text-xs text-muted-foreground">Returns and refunds</span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
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
                        <span
                          className={`ml-2 ${consentSettings.necessary ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {consentSettings.necessary ? '✓ Accepted' : '✗ Rejected'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Analytics Cookies:</span>
                        <span
                          className={`ml-2 ${consentSettings.analytics ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {consentSettings.analytics ? '✓ Accepted' : '✗ Rejected'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Functional Cookies:</span>
                        <span
                          className={`ml-2 ${consentSettings.functional ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {consentSettings.functional ? '✓ Accepted' : '✗ Rejected'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Marketing Cookies:</span>
                        <span
                          className={`ml-2 ${consentSettings.marketing ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {consentSettings.marketing ? '✓ Accepted' : '✗ Rejected'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No cookie preferences set yet. Click "Manage Preferences" to configure your
                      cookie settings.
                    </p>
                  )}
                </div>

                {/* Manage Preferences Button */}
                <div className="flex items-center justify-between space-x-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Modify Cookie Preferences</Label>
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
        </div>
      ),
    },
  ];

  const filteredSections = sections.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query) ||
      section.keywords.some((k) => k.toLowerCase().includes(query))
    );
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-3xl font-bold flex items-center space-x-2">
          <span>Account Settings</span>
        </h1>
        <p className="text-muted-foreground">
          Manage your account preferences, security, and personal data.
        </p>
      </div>

      <div className="space-y-6 mt-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search settings..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val) {
                setOpenSections(['activity', 'communication', 'preferences', 'data', 'privacy']);
              }
            }}
          />
        </div>

        <div className="space-y-4">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            const isOpen = openSections.includes(section.id);
            return (
              <div
                key={section.id}
                className="border rounded-lg bg-card text-card-foreground shadow-sm"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center justify-between w-full p-6 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 pt-0 border-t animate-in slide-in-from-top-2 duration-200">
                    <div className="mt-6">{section.content}</div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredSections.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium">No settings found</h3>
              <p className="text-muted-foreground">
                Try searching for a different keyword or browse the categories.
              </p>
            </div>
          )}
        </div>
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
      <QRScannerDialog open={showQRScanner} onOpenChange={setShowQRScanner} />
    </div>
  );
}
