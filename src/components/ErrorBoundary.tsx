import React from 'react';
import { AlertTriangle, RefreshCcw, Home, Copy, Check, Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: React.ErrorInfo;
    copied: boolean;
    showStack: boolean;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Enhanced Error Boundary Component
 * Catches JavaScript errors in child components and displays a beautiful fallback UI
 * 
 * Features:
 * - Modern, clean error UI
 * - Copy error details button
 * - Expandable stack trace (dev mode)
 * - Reset/retry functionality
 * - Custom fallback support
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { 
            hasError: false,
            copied: false,
            showStack: false
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log the error
        console.error('🚨 ErrorBoundary caught an error:', error);
        console.error('📋 Component stack:', errorInfo.componentStack);
        
        this.setState({
            error,
            errorInfo
        });

        // Call optional error handler
        this.props.onError?.(error, errorInfo);

        // In production, you might want to send to error tracking service
        if (process.env.NODE_ENV === 'production') {
            // Example: Sentry.captureException(error);
        }
    }

    handleReset = () => {
        this.setState({ 
            hasError: false, 
            error: undefined, 
            errorInfo: undefined 
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    handleCopyError = () => {
        const { error, errorInfo } = this.state;
        const errorText = `
Error Report
============
Time: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error: ${error?.name || 'Unknown'}
Message: ${error?.message || 'No message'}

Stack Trace:
${error?.stack || 'No stack trace'}

Component Stack:
${errorInfo?.componentStack || 'No component stack'}
        `.trim();

        navigator.clipboard.writeText(errorText).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { error, errorInfo, copied, showStack } = this.state;
            const isDevelopment = process.env.NODE_ENV !== 'production';

            return (
                <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center p-4">
                    {/* Background pattern */}
                    <div className="absolute inset-0 overflow-hidden opacity-5">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 40 40&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cpath d=&quot;M0 40L40 0H20L0 20M40 40V20L20 40&quot; fill=&quot;%23fff&quot;/%3E%3C/svg%3E')]"></div>
                    </div>

                    <div className="relative z-10 max-w-lg w-full">
                        {/* Main card */}
                        <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-red-500/30 overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                                        <AlertTriangle className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold text-white">Terjadi Kesalahan</h1>
                                        <p className="text-white/70 text-sm">Aplikasi mengalami error</p>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-5">
                                {/* Error message */}
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                    <p className="text-red-300 font-mono text-sm break-all">
                                        {error?.message || 'Unknown error occurred'}
                                    </p>
                                </div>

                                {/* Developer details */}
                                {isDevelopment && (
                                    <div className="border border-yellow-500/30 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => this.setState({ showStack: !showStack })}
                                            className="w-full flex items-center justify-between p-3 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Bug className="w-4 h-4" />
                                                <span className="text-sm font-medium">Stack Trace</span>
                                            </div>
                                            {showStack ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        
                                        {showStack && (
                                            <div className="p-4 bg-gray-950/50 space-y-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-2">Error Stack:</p>
                                                    <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded overflow-auto max-h-32 font-mono">
                                                        {error?.stack}
                                                    </pre>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-2">Component Stack:</p>
                                                    <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded overflow-auto max-h-32 font-mono">
                                                        {errorInfo?.componentStack}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={this.handleReset}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                        Coba Lagi
                                    </button>
                                    <button
                                        onClick={this.handleReload}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                        Refresh
                                    </button>
                                    <button
                                        onClick={this.handleGoHome}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                                    >
                                        <Home className="w-4 h-4" />
                                        Beranda
                                    </button>
                                    <button
                                        onClick={this.handleCopyError}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-4 h-4 text-green-400" />
                                                <span>Tersalin!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                <span>Salin Error</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Help text */}
                                <p className="text-center text-gray-500 text-sm">
                                    Jika masalah berlanjut, hubungi administrator sistem.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <p className="text-center text-gray-600 text-sm mt-6">
                            ABSENTA 13 - Sistem Absensi Digital
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
