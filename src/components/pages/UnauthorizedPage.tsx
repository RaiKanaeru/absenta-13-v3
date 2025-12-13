import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, Home, ShieldX, ArrowLeft } from 'lucide-react';

interface UnauthorizedPageProps {
    type?: 'unauthorized' | 'forbidden';
    message?: string;
}

/**
 * Unauthorized/Forbidden Page (401/403)
 * Clean page for authentication and authorization errors
 */
const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({ 
    type = 'unauthorized',
    message 
}) => {
    const navigate = useNavigate();
    const isForbidden = type === 'forbidden';

    const defaultMessage = isForbidden
        ? 'Anda tidak memiliki izin untuk mengakses halaman ini.'
        : 'Sesi Anda telah berakhir atau Anda belum login.';

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-md w-full text-center">
                {/* Lock/Shield Icon */}
                <div className="mb-8">
                    <div className="mx-auto w-28 h-28 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-white/10 shadow-2xl">
                        <ShieldX className="w-14 h-14 text-blue-400" />
                    </div>
                </div>

                {/* Error code */}
                <div className="mb-4">
                    <span className="text-6xl font-black text-white/20">
                        {isForbidden ? '403' : '401'}
                    </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-white mb-3">
                    {isForbidden ? 'Akses Ditolak' : 'Akses Tidak Sah'}
                </h1>

                {/* Message */}
                <p className="text-gray-400 mb-8 leading-relaxed">
                    {message || defaultMessage}
                </p>

                {/* Info box */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-8">
                    <p className="text-blue-300 text-sm">
                        {isForbidden 
                            ? 'Jika Anda merasa ini adalah kesalahan, hubungi administrator untuk mendapatkan akses yang sesuai.'
                            : 'Silakan login dengan akun yang valid untuk melanjutkan.'}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        onClick={() => navigate(-1)}
                        variant="outline"
                        className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali
                    </Button>
                    
                    {!isForbidden && (
                        <Button
                            onClick={() => {
                                localStorage.removeItem('token');
                                navigate('/login');
                            }}
                            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                        >
                            <LogIn className="w-4 h-4 mr-2" />
                            Login
                        </Button>
                    )}
                    
                    <Button
                        onClick={() => navigate('/')}
                        variant="outline"
                        className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                    >
                        <Home className="w-4 h-4 mr-2" />
                        Beranda
                    </Button>
                </div>

                {/* Footer */}
                <p className="mt-10 text-gray-600 text-sm">
                    ABSENTA 13 - Sistem Absensi Digital
                </p>
            </div>
        </div>
    );
};

export default UnauthorizedPage;
