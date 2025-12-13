import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, RefreshCcw, AlertTriangle, Copy, Check, Bug, ChevronDown, ChevronUp } from 'lucide-react';

interface ServerErrorPageProps {
    error?: {
        code?: number;
        message?: string;
        details?: string | string[];
        requestId?: string;
        stack?: string;
    };
    onRetry?: () => void;
}

/**
 * 500 Server Error Page
 * Informative error page with debugging details (in dev mode)
 */
const ServerErrorPage: React.FC<ServerErrorPageProps> = ({ error, onRetry }) => {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const isDevelopment = import.meta.env.DEV;

    const copyErrorDetails = () => {
        const errorText = `
Error Report
============
Code: ${error?.code || 'N/A'}
Message: ${error?.message || 'Unknown error'}
Request ID: ${error?.requestId || 'N/A'}
Time: ${new Date().toISOString()}
${error?.details ? `Details: ${JSON.stringify(error.details)}` : ''}
${error?.stack ? `Stack:\n${error.stack}` : ''}
        `.trim();

        navigator.clipboard.writeText(errorText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-950 via-gray-900 to-gray-900 flex items-center justify-center p-4">
            {/* Background pattern */}
            <div className="absolute inset-0 overflow-hidden opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}></div>
            </div>

            <div className="relative z-10 max-w-xl w-full">
                {/* Error card */}
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-red-500/30 shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                                <AlertTriangle className="w-10 h-10 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">500</h1>
                                <p className="text-white/80">Server Error</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                Terjadi Kesalahan Server
                            </h2>
                            <p className="text-gray-400">
                                {error?.message || 'Maaf, terjadi kesalahan pada server kami. Tim teknis sudah diberitahu dan sedang memperbaiki masalah ini.'}
                            </p>
                        </div>

                        {/* Error code & request ID */}
                        {(error?.code || error?.requestId) && (
                            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                                {error?.code && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Error Code</span>
                                        <span className="text-red-400 font-mono">{error.code}</span>
                                    </div>
                                )}
                                {error?.requestId && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Request ID</span>
                                        <span className="text-gray-300 font-mono text-xs">{error.requestId}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Developer details (only in dev mode) */}
                        {isDevelopment && error && (
                            <div className="border border-yellow-500/30 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setShowDetails(!showDetails)}
                                    className="w-full flex items-center justify-between p-3 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Bug className="w-4 h-4" />
                                        <span className="text-sm font-medium">Developer Info</span>
                                    </div>
                                    {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                
                                {showDetails && (
                                    <div className="p-4 space-y-3 bg-gray-950/50">
                                        {error.details && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Details:</p>
                                                <pre className="text-xs text-gray-300 bg-gray-900 p-2 rounded overflow-auto max-h-20">
                                                    {typeof error.details === 'string' 
                                                        ? error.details 
                                                        : JSON.stringify(error.details, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                        {error.stack && (
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Stack Trace:</p>
                                                <pre className="text-xs text-gray-400 bg-gray-900 p-2 rounded overflow-auto max-h-32 font-mono">
                                                    {error.stack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            {onRetry && (
                                <Button
                                    onClick={onRetry}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                >
                                    <RefreshCcw className="w-4 h-4 mr-2" />
                                    Coba Lagi
                                </Button>
                            )}
                            <Button
                                onClick={() => navigate('/')}
                                variant="outline"
                                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                            >
                                <Home className="w-4 h-4 mr-2" />
                                Ke Beranda
                            </Button>
                            <Button
                                onClick={copyErrorDetails}
                                variant="outline"
                                className="border-gray-600 text-gray-300 hover:bg-gray-800"
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </Button>
                        </div>

                        {/* Contact support */}
                        <div className="text-center text-sm text-gray-500">
                            <p>
                                Butuh bantuan? Hubungi administrator sistem{' '}
                                {error?.requestId && (
                                    <span>dengan kode: <code className="text-gray-400">{error.requestId}</code></span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerErrorPage;
