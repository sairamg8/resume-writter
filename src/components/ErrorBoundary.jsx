import { Component } from 'react';
import { crashShown } from '@/utils/lazyPage';

/**
 * Catches unhandled JavaScript errors anywhere in the child component tree,
 * logs the error, and renders a fallback recovery UI instead of crashing the whole page.
 * A new `resetKey` (the route's path, AppRoutes) clears a caught error, so leaving the page that
 * crashed shows the next one (R2-072).
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
    crashShown(); // a page whose file failed is asked for again from here on (lazyPage)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-cv-ground flex items-center justify-center p-4">
          <div className="cv-card max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-cv-bad-soft text-cv-bad flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h1 className="text-lg font-bold text-cv-ink">Something went wrong</h1>
            <p className="text-sm text-cv-muted">
              An unexpected error occurred while loading this page.
            </p>
            {this.state.error?.message && (
              <pre className="cv-notice-bad text-xs p-3 overflow-auto text-left max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.assign('/');
                }}
                className="px-4 py-2 text-sm font-medium text-cv-body bg-cv-sunken hover:bg-cv-stage rounded-cv-control transition-colors"
              >
                Go to Home
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 text-sm font-semibold text-white bg-cv-brand hover:bg-cv-brand-pressed rounded-cv-control transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
