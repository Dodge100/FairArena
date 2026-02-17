import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Ban, Mail, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface IPBlockedPageProps {
  reasons?: string[];
  onRetry?: () => void;
}

const IPBlockedPage = ({ reasons = [], onRetry }: IPBlockedPageProps) => {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(30);
  const [referenceId, setReferenceId] = useState('');

  useEffect(() => {
    setReferenceId(Math.random().toString(36).substring(7).toUpperCase());
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@fairarena.app?subject=IP%20Security%20Block%20Appeal';
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <Card className="max-w-md w-full shadow-xl border-red-100 dark:border-red-900/30 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />

        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto bg-red-50 dark:bg-red-900/20 p-3 rounded-full w-fit mb-4">
            <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('ipBlocked.title')}
          </CardTitle>
          <CardDescription className="text-base text-neutral-600 dark:text-neutral-400 mt-2">
            {t('ipBlocked.description')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {reasons.length > 0 && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('ipBlocked.flagsTitle')}</AlertTitle>
              <AlertDescription className="mt-2">
                <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
                  {reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-200 flex items-center gap-2">
              <Ban className="w-4 h-4 text-neutral-500" />
              {t('ipBlocked.resolution.title')}
            </h3>
            <div className="space-y-3 pl-1">
              {(t('ipBlocked.resolution.steps', { returnObjects: true }) as string[]).map(
                (step, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-medium text-neutral-500">
                      {i + 1}
                    </span>
                    <span className="leading-5">{step}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </CardContent>

        <Separator className="bg-neutral-100 dark:bg-neutral-800" />

        <CardFooter className="flex flex-col gap-3 pt-6 pb-8">
          <Button
            onClick={handleRetry}
            className="w-full h-11 text-base font-medium shadow-sm transition-all hover:scale-[1.02]"
            disabled={countdown > 0}
          >
            {countdown > 0 ? (
              <>
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                {t('ipBlocked.retry')} ({countdown}s)
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {t('ipBlocked.retry')}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handleContactSupport}
            className="w-full h-11 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <Mail className="mr-2 h-4 w-4" />
            {t('ipBlocked.contact')}
          </Button>

          <p className="text-xs text-center text-neutral-400 mt-4">
            Reference ID: {referenceId}
          </p>
        </CardFooter>
      </Card>

      <div className="fixed bottom-4 text-xs text-neutral-400 font-mono">
        {t('ipBlocked.footer')}
      </div>
    </div>
  );
};

export default IPBlockedPage;
