import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';
import { getApiUrl } from '@/config/api';

const SimpleLetterheadInit: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleInitLetterhead = async () => {
    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      const response = await fetch(getApiUrl('/api/admin/init-letterhead'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/html')) {
        setStatus('error');
        setMessage('Server mengembalikan halaman error. Pastikan server berjalan dengan benar.');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage(data.message);
      } else {
        setStatus('error');
        setMessage(data.message || 'Gagal menginisialisasi letterhead');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Error menginisialisasi letterhead: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          Inisialisasi Logo Laporan
        </CardTitle>
        <CardDescription>
          Jika logo tidak muncul di laporan, klik tombol di bawah untuk menginisialisasi konfigurasi default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Cara menggunakan:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Klik tombol "Inisialisasi Letterhead" di bawah</li>
                  <li>Tunggu hingga muncul pesan sukses</li>
                  <li>Refresh halaman untuk melihat logo</li>
                  <li>Logo akan muncul di semua laporan Excel</li>
                </ol>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleInitLetterhead} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menginisialisasi...
              </>
            ) : (
              'Inisialisasi Letterhead'
            )}
          </Button>

          {status === 'success' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Berhasil!</span>
              </div>
              <p className="text-sm text-green-700 mt-1">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Error!</span>
              </div>
              <p className="text-sm text-red-700 mt-1">{message}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleLetterheadInit;
