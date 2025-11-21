import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
        <Dialog open>
          <DialogContent className="max-w-md mx-auto w-full bg-linear-to-br from-slate-50 to-slate-200 shadow-2xl rounded-2xl p-8 max-h-[90vh] overflow-auto flex flex-col items-center">
            <DialogHeader>
              <DialogTitle className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                <div className="inline-flex items-center justify-center bg-linear-to-br from-red-400 to-yellow-400 rounded-full w-10 h-10 mr-2">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="12" fill="#ef4444" />
                    <path d="M12 7v5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="1" fill="#fff" />
                  </svg>
                </div>
                Exception Occurred
              </DialogTitle>
            </DialogHeader>
            <div className="mt-6 mb-4 text-slate-600 text-base leading-relaxed w-full">
              <p className="mb-2">
                <strong>Oops!</strong> Something went wrong and the app cannot continue.
              </p>
              <p>Please report this issue to help us improve the application.</p>
              <div className="bg-linear-to-r from-yellow-100 to-red-100 text-red-800 p-4 rounded-lg mt-5 text-sm font-mono max-h-56 overflow-auto shadow-sm border border-yellow-200 wrap-break-word whitespace-pre-wrap w-full">
                {this.state.error.message}
                {this.state.error.stack && (
                  <details className="mt-3 text-red-800 text-xs">
                    <summary className="cursor-pointer font-semibold">Stack Trace</summary>
                    <pre className="max-h-24 overflow-auto mt-1">{this.state.error.stack}</pre>
                  </details>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4 w-full">
              <button
                onClick={this.copyError}
                className={`px-4 py-2 rounded-md font-semibold text-sm text-white transition-all flex-1 ${
                  this.state.copied
                    ? 'bg-linear-to-r from-green-500 to-green-600'
                    : 'bg-linear-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
                }`}
              >
                {this.state.copied ? '✓ Copied!' : 'Copy Error'}
              </button>
              <button
                onClick={this.reportOnGitHub}
                className="px-4 py-2 rounded-md font-semibold text-sm text-white bg-linear-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 transition-all flex-1"
              >
                Report on GitHub
              </button>
            </div>
            <DialogFooter className="justify-center mt-4 w-full">
              <button
                onClick={this.handleDashboard}
                className="bg-linear-to-r from-blue-600 to-blue-400 text-white px-7 py-3 rounded-lg font-bold text-base shadow-md hover:shadow-lg transition-all w-full max-w-xs mx-2"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-linear-to-r from-green-500 to-blue-400 text-white px-7 py-3 rounded-lg font-bold text-base shadow-md hover:shadow-lg transition-all w-full max-w-xs mx-2 outline-none"
                aria-label="Refresh the page"
                title="Refresh the page"
                autoFocus
              >
                Refresh
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
    return this.props.children;
  }
}
