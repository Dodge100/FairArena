import { BarChart3, Cookie, Settings, Shield } from 'lucide-react';
import { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox as UICheckbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

interface ConsentSettings {
    necessary: boolean; // Always true, can't be disabled
    analytics: boolean;
    marketing: boolean;
    functional: boolean; // Always true, can't be disabled
}

interface CookieConsentModalProps {
    isOpen: boolean;
    onClose: (settings: ConsentSettings) => void;
    onAcceptAll: () => void;
    onRejectAll: () => void;
}

export function CookieConsentModal({
    isOpen,
    onClose,
    onAcceptAll,
    onRejectAll
}: CookieConsentModalProps) {
    const [settings, setSettings] = useState<ConsentSettings>({
        necessary: true,
        analytics: false,
        marketing: false,
        functional: true,
    });

    const updateSetting = (key: keyof ConsentSettings, value: boolean) => {
        if (key === 'necessary' || key === 'functional') return; // Necessary and functional cookies can't be disabled
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveSettings = () => {
        localStorage.setItem('cookieConsent', JSON.stringify({
            ...settings,
            timestamp: new Date().toISOString(),
            version: '1.0'
        }));
        onClose(settings);
    };

    const handleAcceptAll = () => {
        const allSettings = {
            necessary: true,
            analytics: true,
            marketing: true,
            functional: true,
        };
        localStorage.setItem('cookieConsent', JSON.stringify({
            ...allSettings,
            timestamp: new Date().toISOString(),
            version: '1.0'
        }));
        onAcceptAll();
    };

    const handleRejectAll = () => {
        const minimalSettings = {
            necessary: true,
            analytics: false,
            marketing: false,
            functional: false,
        };
        localStorage.setItem('cookieConsent', JSON.stringify({
            ...minimalSettings,
            timestamp: new Date().toISOString(),
            version: '1.0'
        }));
        onRejectAll();
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <Cookie className="h-6 w-6 text-primary" />
                        <DialogTitle className="text-2xl">Cookie Preferences</DialogTitle>
                    </div>
                    <DialogDescription className="text-base">
                        We use cookies and similar technologies to enhance your experience, analyze site usage,
                        and assist in our marketing efforts. Please choose which categories you'd like to allow.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Necessary Cookies */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Shield className="h-5 w-5 text-green-600" />
                                    <CardTitle className="text-lg">Necessary Cookies</CardTitle>
                                    <Badge variant="secondary" className="text-xs">Required</Badge>
                                </div>
                                <UICheckbox checked={settings.necessary} disabled />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                These cookies are essential for the website to function properly. They enable core
                                functionality such as security, network management, and accessibility. You cannot
                                opt out of these cookies without severely impacting the website's functionality.
                            </CardDescription>
                            <div className="mt-3 text-sm text-muted-foreground">
                                <strong>Purpose:</strong> Authentication, security, website functionality<br />
                                <strong>Duration:</strong> Session or up to 1 year<br />
                                <strong>Legal basis:</strong> Legitimate interest / Contract performance
                            </div>
                        </CardContent>
                    </Card>

                    {/* Analytics Cookies */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="h-5 w-5 text-blue-600" />
                                    <CardTitle className="text-lg">Analytics Cookies</CardTitle>
                                    <Badge variant="outline" className="text-xs">Optional</Badge>
                                </div>
                                <UICheckbox
                                    checked={settings.analytics}
                                    onCheckedChange={(checked) => updateSetting('analytics', checked as boolean)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                These cookies help us understand how visitors interact with our website by collecting
                                and reporting information anonymously. This helps us improve our website's performance
                                and user experience.
                            </CardDescription>
                            <div className="mt-3 text-sm text-muted-foreground">
                                <strong>Services:</strong> Microsoft Clarity, Google Analytics, Firebase Analytics<br />
                                <strong>Purpose:</strong> Website analytics and performance monitoring<br />
                                <strong>Duration:</strong> Up to 2 years<br />
                                <strong>Legal basis:</strong> Consent
                            </div>
                        </CardContent>
                    </Card>

                    {/* Functional Cookies */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Settings className="h-5 w-5 text-purple-600" />
                                    <CardTitle className="text-lg">Functional Cookies</CardTitle>
                                    <Badge variant="secondary" className="text-xs">Required</Badge>
                                </div>
                                <UICheckbox checked={settings.functional} disabled />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                These cookies enable enhanced functionality and personalization. They allow the website
                                to remember choices you make (such as your username, language, or the region you are in)
                                and provide enhanced, more personal features. These cookies are required for the website
                                to function properly.
                            </CardDescription>
                            <div className="mt-3 text-sm text-muted-foreground">
                                <strong>Services:</strong> Theme preferences, language settings, user interface customization<br />
                                <strong>Purpose:</strong> Enhanced user experience and personalization<br />
                                <strong>Duration:</strong> Up to 1 year<br />
                                <strong>Legal basis:</strong> Legitimate interest / Consent
                            </div>
                        </CardContent>
                    </Card>

                    {/* Marketing Cookies */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-5 w-5 rounded bg-orange-100 flex items-center justify-center">
                                        <span className="text-orange-600 text-xs font-bold">AD</span>
                                    </div>
                                    <CardTitle className="text-lg">Marketing Cookies</CardTitle>
                                    <Badge variant="outline" className="text-xs">Optional</Badge>
                                </div>
                                <UICheckbox
                                    checked={settings.marketing}
                                    onCheckedChange={(checked) => updateSetting('marketing', checked as boolean)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                These cookies are used to track visitors across websites to display ads that are
                                relevant and engaging for individual users. We may share this information with
                                advertisers or use it to improve our advertising campaigns.
                            </CardDescription>
                            <div className="mt-3 text-sm text-muted-foreground">
                                <strong>Services:</strong> Advertising networks, social media pixels<br />
                                <strong>Purpose:</strong> Targeted advertising and campaign measurement<br />
                                <strong>Duration:</strong> Up to 2 years<br />
                                <strong>Legal basis:</strong> Consent
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
                    <Button variant="outline" onClick={handleRejectAll} className="flex-1">
                        Reject All
                    </Button>
                    <Button variant="outline" onClick={handleSaveSettings} className="flex-1">
                        Save Settings
                    </Button>
                    <Button onClick={handleAcceptAll} className="flex-1">
                        Accept All
                    </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground mt-4">
                    By clicking "Accept All", you consent to the use of cookies for all purposes described above.
                    You can change your preferences at any time by visiting our{' '}
                    <a href="/cookie-policy" className="text-primary hover:underline">
                        Cookie Policy
                    </a>
                    .
                </div>
            </DialogContent>
        </Dialog>
    );
}
