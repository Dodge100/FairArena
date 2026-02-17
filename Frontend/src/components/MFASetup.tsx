import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/apiClient';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, Download, Loader2, Shield, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface MFASetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function MFASetup({ onComplete, onCancel }: MFASetupProps) {
  const [step, setStep] = useState<'init' | 'verify' | 'backup'>('init');

  const [qrCode, setQrCode] = useState<string>('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const startSetupMutation = useMutation({
    mutationFn: () =>
      apiRequest<{
        success: boolean;
        data: { qrCode: string; manualEntryKey: string; backupCodes: string[] };
        message?: string;
      }>(`${import.meta.env.VITE_API_BASE_URL}/api/v1/mfa/setup`, { method: 'POST' }),
    onSuccess: (data) => {
      if (data.success) {
        setQrCode(data.data.qrCode);
        setSecretKey(data.data.manualEntryKey);
        setBackupCodes(data.data.backupCodes);
        setStep('verify');
      } else {
        toast.error(data.message || 'Failed to start MFA setup');
      }
    },
    onError: () => toast.error('Failed to start MFA setup'),
  });

  const verifySetupMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest<{ success: boolean; message?: string }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/mfa/verify-setup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        },
      ),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Two-factor authentication enabled!');
        setStep('backup');
      } else {
        toast.error(data.message || 'Verification failed');
      }
    },
    onError: () => toast.error('Verification failed'),
  });

  const startSetup = () => startSetupMutation.mutate();

  const verifySetup = () => {
    if (verifyCode.length !== 6) return;
    verifySetupMutation.mutate(verifyCode);
  };

  const loading = startSetupMutation.isPending || verifySetupMutation.isPending;

  const copySecret = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast.success('Secret key copied');
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
    toast.success('Backup codes copied');
  };

  const downloadBackupCodes = () => {
    const element = document.createElement('a');
    const file = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'fairarena-backup-codes.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (step === 'init') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Set up Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Protect your account by adding an extra layer of security.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Smartphone className="w-5 h-5 mt-0.5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">You'll need an authenticator app</p>
                <p className="text-muted-foreground mt-1">
                  Download an app like Google Authenticator, Authy, or Microsoft Authenticator on
                  your phone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={onCancel} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={startSetup} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Get Started
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan QR Code</CardTitle>
          <CardDescription>
            Scan this code with your authenticator app to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto border">
            {qrCode && <img src={qrCode} alt="QR Code" className="w-48 h-48" />}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-center text-muted-foreground">Or enter code manually</p>
            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30 font-mono text-sm">
              <span className="flex-1 truncate text-center">{secretKey}</span>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copySecret}>
                {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Verify Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000 000"
                className="flex-1 px-3 py-2 border rounded-md text-center text-lg tracking-widest font-mono"
              />
              <Button onClick={verifySetup} disabled={verifyCode.length !== 6 || loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-500">
          <Check className="w-5 h-5" />
          Setup Complete!
        </CardTitle>
        <CardDescription>
          Save these backup codes in a safe place. You can use them to log in if you lose your
          phone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted p-4 rounded-lg grid grid-cols-2 gap-4 font-mono text-sm text-center">
          {backupCodes.map((code) => (
            <div key={code} className="p-1">
              {code}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={copyBackupCodes} variant="outline" className="flex-1">
            {copiedCodes ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy Codes
          </Button>
          <Button onClick={downloadBackupCodes} variant="outline" className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>

        <Button onClick={onComplete} className="w-full">
          Done
        </Button>
      </CardContent>
    </Card>
  );
}
