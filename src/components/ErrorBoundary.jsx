import { Component } from 'react';

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
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-600">
              An unexpected error occurred while loading this page.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-red-600 bg-red-50 p-3 rounded-lg overflow-auto text-left max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.assign('/');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Go to Home
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
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
