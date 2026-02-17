import { useTheme } from '@/hooks/useTheme';
import { motion } from 'framer-motion';
import { Suspense, type ReactNode } from 'react';
import { Spotlight } from './ui/Spotlight';

// Loading fallback components
export const PageLoadingFallback = () => {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden">
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill={theme === 'dark' ? '#DDFF00' : '#b5c800'}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: [0.4, 1, 0.4],
            scale: [0.95, 1, 0.95],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative"
        >
          <img
            src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin"
            className="w-48 h-auto"
            alt="FairArena Logo"
            style={{ filter: theme === 'light' ? 'invert(1)' : 'none' }}
          />

          {/* Animated ring around the logo */}
          <motion.div
            className="absolute inset-0 -m-4 border-2 border-primary/20 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-0 -m-4 border-t-2 border-primary rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent"
          >
            FairArena
          </motion.h2>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 120 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="h-[2px] bg-primary/30 rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-primary"
              animate={{
                x: [-120, 120],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* Background Decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
      </div>
    </div>
  );
};

export const ComponentLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-12 w-full min-h-[200px] gap-4">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full"
    />
    <p className="text-xs font-medium text-muted-foreground animate-pulse">
      Initializing Component...
    </p>
  </div>
);

export const ModalLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-20 w-full gap-4">
    <div className="relative">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
      </div>
    </div>
    <p className="text-sm font-semibold text-foreground/70 tracking-tight">Preparing Modal</p>
  </div>
);

// Lazy loading wrapper with error boundary
interface LazyComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const LazyComponent = ({
  children,
  fallback = <ComponentLoadingFallback />,
}: LazyComponentProps) => <Suspense fallback={fallback}>{children}</Suspense>;

// Helper removed to avoid react-refresh issues

// Error boundary for lazy-loaded chunks
import { Component, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class LazyErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <div className="max-w-md text-center">
              <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
              <p className="text-muted-foreground mb-6">
                Failed to load this page. Please try refreshing.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
