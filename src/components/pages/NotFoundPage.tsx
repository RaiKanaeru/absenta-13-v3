import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search, HelpCircle } from 'lucide-react';

/**
 * 404 Not Found Page
 * Beautiful, modern error page with helpful navigation options
 */
const NotFoundPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative z-10 max-w-lg w-full text-center">
                {/* 404 Number */}
                <div className="mb-8">
                    <h1 className="text-9xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
                        404
                    </h1>
                </div>

                {/* Error Icon */}
                <div className="mb-6">
                    <div className="mx-auto w-24 h-24 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20">
                        <Search className="w-12 h-12 text-white/80" />
                    </div>
                </div>

                {/* Error Message */}
                <div className="mb-8 space-y-3">
                    <h2 className="text-2xl font-bold text-white">
                        Halaman Tidak Ditemukan
                    </h2>
                    <p className="text-gray-400 text-lg">
                        Oops! Halaman yang Anda cari tidak ada atau telah dipindahkan.
                    </p>
                </div>

                {/* Helpful suggestions */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 mb-8 border border-white/10">
                    <h3 className="text-white font-semibold mb-3 flex items-center justify-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        Saran
                    </h3>
                    <ul className="text-gray-400 text-sm space-y-2 text-left">
                        <li>• Periksa kembali URL yang Anda masukkan</li>
                        <li>• Pastikan Anda memiliki akses ke halaman tersebut</li>
                        <li>• Coba kembali ke halaman sebelumnya</li>
                    </ul>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        onClick={() => navigate(-1)}
                        variant="outline"
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali
                    </Button>
                    <Button
                        onClick={() => navigate('/')}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
                    >
                        <Home className="w-4 h-4 mr-2" />
                        Ke Beranda
                    </Button>
                </div>

                {/* Footer */}
                <p className="mt-8 text-gray-500 text-sm">
                    ABSENTA 13 - Sistem Absensi Digital
                </p>
            </div>

            {/* Animation styles */}
            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
            `}</style>
        </div>
    );
};

export default NotFoundPage;
