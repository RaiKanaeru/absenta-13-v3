import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('📋 Component stack trace:', errorInfo.componentStack);
    console.error('📄 Error stack:', error.stack);
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <h1 className="text-xl font-bold text-red-800">Something went wrong</h1>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Error Details:</h3>
                <p className="text-sm text-gray-600 bg-gray-100 p-3 rounded font-mono">
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Component Stack:</h3>
                <pre className="text-xs text-gray-600 bg-gray-100 p-3 rounded overflow-auto max-h-40">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
              
              <div className="flex space-x-2">
                <button 
                  onClick={() => this.setState({ hasError: false })}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  Try Again
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
