import { Suspense, type ReactNode } from 'react';

// Loading fallback components
export const PageLoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
    </div>
);

export const ComponentLoadingFallback = () => (
    <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
);

export const ModalLoadingFallback = () => (
    <div className="flex items-center justify-center p-12">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
);

// Lazy loading wrapper with error boundary
interface LazyComponentProps {
    children: ReactNode;
    fallback?: ReactNode;
}

export const LazyComponent = ({
    children,
    fallback = <ComponentLoadingFallback />
}: LazyComponentProps) => (
    <Suspense fallback={fallback}>
        {children}
    </Suspense>
);

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
            return this.props.fallback || (
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
            );
        }

        return this.props.children;
    }
}
