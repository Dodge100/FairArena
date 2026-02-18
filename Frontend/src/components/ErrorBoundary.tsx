import {
  AlertTriangle,
  Check,
  Copy,
  Github,
  Home,
  RefreshCw,
} from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; copied: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleDashboard = () => {
    window.location.replace('/dashboard');
  };

  copyError = async () => {
    if (!this.state.error) return;

    const errorText = `Error: ${this.state.error.message}\n\nStack Trace:\n${this.state.error.stack || 'No stack trace available'}`;

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error:', err);
    }
  };

  reportOnGitHub = () => {
    if (!this.state.error) return;

    const title = encodeURIComponent(`Bug Report: ${this.state.error.message}`);
    const body = encodeURIComponent(
      `## Bug Report\n\n**Error Message:**\n${this.state.error.message}\n\n**Stack Trace:**\n\`\`\`\n${this.state.error.stack || 'No stack trace available'}\n\`\`\`\n\n**Browser:** ${navigator.userAgent}\n**URL:** ${window.location.href}\n**Timestamp:** ${new Date().toISOString()}\n\n**Steps to Reproduce:**\n1. \n2. \n3. \n\n**Expected Behavior:**\n\n\n**Actual Behavior:**\n\n`,
    );

    const url = `https://github.com/FairArena/FairArena/issues/new?title=${title}&body=${body}&labels=bug`;
    window.open(url, '_blank');
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
          <Card className="w-full max-w-lg shadow-xl dark:border-zinc-800">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-500" />
              </div>
              <CardTitle className="text-2xl font-bold">Something went wrong</CardTitle>
              <CardDescription className="text-base mt-2">
                We apologize for the inconvenience. An unexpected error has occurred.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive" className="max-h-64 overflow-y-auto break-all">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription className="mt-2 font-mono text-xs">
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <div className="mt-2 border-t border-red-200 pt-2 dark:border-red-800/50 text-[10px] opacity-80">
                      <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={this.copyError}
                >
                  {this.state.copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {this.state.copied ? 'Copied' : 'Copy Error'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={this.reportOnGitHub}
                >
                  <Github className="h-4 w-4" />
                  Report Issue
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 sm:flex-row pt-2">
              <Button onClick={() => window.location.reload()} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleDashboard}
                className="w-full gap-2"
                variant="secondary"
              >
                <Home className="h-4 w-4" />
                Back to Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
