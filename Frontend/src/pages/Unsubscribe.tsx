import { DataSaverImage } from '@/components/ui/DataSaverImage';
import { Spotlight } from '@/components/ui/Spotlight';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDataSaverUtils } from '@/hooks/useDataSaverUtils';
import { publicApiFetch } from '@/lib/apiClient';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

function Unsubscribe() {
  const { t } = useTranslation();
  const { email } = useParams<{ email: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const { cn, shouldLoadImage } = useDataSaverUtils();

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = import.meta.env.VITE_API_BASE_URL;
      const response = await publicApiFetch(`${apiUrl}/api/v1/newsletter/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to unsubscribe');
      }
      return data;
    },
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.message || t('unsubscribe.success.defaultMessage'));
    },
    onError: (error: Error) => {
      console.error('Unsubscribe error:', error);
      setStatus('error');
      setMessage(error.message || t('unsubscribe.error.defaultMessage'));
    },
  });

  useEffect(() => {
    if (!email) {
      setTimeout(() => {
        setStatus('error');
        setMessage(t('unsubscribe.error.invalidEmail'));
      }, 0);
      return;
    }
    unsubscribeMutation.mutate();
  }, [email]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/[0.96] antialiased bg-grid-white/[0.02] overflow-y-auto w-full h-full flex items-center justify-center">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      <div className="p-4 max-w-4xl mx-auto relative z-10 w-full flex flex-col items-center">
        <div className="flex justify-center mb-8">
          <DataSaverImage
            src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
            alt="FairArena Logo"
            className="w-32 h-20 object-contain brightness-0 invert opacity-80"
            width={128}
            height={80}
            loading="eager"
            draggable={false}
            fallback={
              <div className="w-32 h-20 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">FA</span>
              </div>
            }
          />
        </div>

        <Card className="w-full bg-zinc-900 border-zinc-800 text-zinc-100 shadow-2xl backdrop-blur-xl bg-opacity-80">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-white mb-2">{t('unsubscribe.title')}</CardTitle>
            <CardDescription className="text-zinc-400">
              {t('unsubscribe.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 min-h-[160px]">
            {status === 'loading' && (
              <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-500">
                <Loader2 className={cn("h-10 w-10 text-zinc-500", shouldLoadImage && "animate-spin")} />
                <p className="text-zinc-500 text-sm font-medium">{t('unsubscribe.processing')}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-500">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-semibold text-white">{t('unsubscribe.success.title')}</h3>
                  <p className="text-zinc-400 text-sm max-w-[280px] mx-auto">{message}</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-500">
                <XCircle className="h-12 w-12 text-red-500" />
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-semibold text-white">{t('unsubscribe.error.title')}</h3>
                  <p className="text-zinc-400 text-sm max-w-[280px] mx-auto">{message}</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center pt-2 pb-6">
            <Button
              asChild
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all duration-300"
            >
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('unsubscribe.returnHome')}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} FairArena. {t('unsubscribe.rightsReserved')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Unsubscribe;
