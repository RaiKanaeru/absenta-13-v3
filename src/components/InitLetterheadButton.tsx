import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getApiUrl } from '@/config/api';

interface InitLetterheadButtonProps {
  onSuccess?: () => void;
}

const InitLetterheadButton: React.FC<InitLetterheadButtonProps> = ({ onSuccess }) => {
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
      if (contentType && contentType.includes('text/html')) {
        setStatus('error');
        setMessage('Server mengembalikan halaman error. Pastikan server berjalan dengan benar.');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage(data.message);
        if (onSuccess) {
          onSuccess();
        }
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Inisialisasi Letterhead
        </CardTitle>
        <CardDescription>
          Klik tombol di bawah untuk menginisialisasi konfigurasi letterhead default jika logo belum muncul di laporan.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            'Inisialisasi Letterhead Default'
          )}
        </Button>

        {status === 'success' && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Berhasil!</span>
            </div>
            <p className="text-sm text-green-700 mt-1">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Error!</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InitLetterheadButton;
