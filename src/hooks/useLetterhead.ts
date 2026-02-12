import { useState, useEffect, useCallback } from 'react';
import { apiCall } from '@/utils/apiClient';

export interface LetterheadConfig {
  enabled: boolean;
  logoLeftUrl: string;
  logoRightUrl: string;
  lines: Array<{
    text: string;
    fontWeight: 'normal' | 'bold';
  }>;
  alignment: 'left' | 'center' | 'right';
}

const DEFAULT_LETTERHEAD: LetterheadConfig = {
  enabled: true,
  logoLeftUrl: "",
  logoRightUrl: "",
  lines: [
    { text: "PEMERINTAH DAERAH PROVINSI JAWA BARAT", fontWeight: "bold" },
    { text: "DINAS PENDIDIKAN", fontWeight: "bold" },
    { text: "SMK NEGERI 13 BANDUNG", fontWeight: "bold" },
    { text: "Jl. Soekarno-Hatta Km. 10 Bandung, Jawa Barat 40286", fontWeight: "normal" },
    { text: "Telepon: (022) 7318960 | Website: http://www.smkn-13.sch.id", fontWeight: "normal" }
  ],
  alignment: "center"
};

// Cache untuk menyimpan konfigurasi kop per reportKey
const letterheadCache: Map<string, LetterheadConfig> = new Map();
const cacheTimestamps: Map<string, number> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 menit

const getCachedLetterhead = (cacheKey: string): LetterheadConfig | null => {
  if (letterheadCache.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey) || 0;
    if ((Date.now() - timestamp) < CACHE_DURATION) {
      return letterheadCache.get(cacheKey) || null;
    }
  }
  return null;
};

export function useLetterhead(reportKey?: string) {
  const [letterhead, setLetterhead] = useState<LetterheadConfig>(DEFAULT_LETTERHEAD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLetterhead = useCallback(async (forceRefresh = false) => {
    const cacheKey = reportKey || 'global';
    
    // Cek cache jika tidak force refresh
    if (!forceRefresh) {
      const cached = getCachedLetterhead(cacheKey);
      if (cached) {
        setLetterhead(cached);
        return cached;
      }
    }

    try {
      setLoading(true);
      setError(null);

      // Gunakan endpoint baru yang mendukung reportKey
      const endpoint = reportKey 
        ? `/api/admin/letterhead?reportKey=${encodeURIComponent(reportKey)}`
        : '/api/admin/letterhead';
        
      const data = await apiCall<{ success: boolean; data: LetterheadConfig; error?: string }>(endpoint);
      
      if (data.success && data.data) {
        const config = data.data as LetterheadConfig;
        
        // Update cache
        letterheadCache.set(cacheKey, config);
        cacheTimestamps.set(cacheKey, Date.now());
        
        setLetterhead(config);
        return config;
      } else {
        throw new Error(data.error || 'Gagal memuat konfigurasi kop laporan');
      }
     } catch (err) {
       const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat konfigurasi';
       setError(errorMessage);
       
       // Fallback ke default jika gagal
       setLetterhead(DEFAULT_LETTERHEAD);
       return DEFAULT_LETTERHEAD;
     } finally {
      setLoading(false);
    }
  }, [reportKey]);

  const refreshLetterhead = useCallback(() => {
    return fetchLetterhead(true);
  }, [fetchLetterhead]);

  // Load letterhead on mount
  useEffect(() => {
    fetchLetterhead();
  }, [fetchLetterhead]);

  return {
    letterhead,
    loading,
    error,
    fetchLetterhead,
    refreshLetterhead
  };
}

// Utility function untuk render letterhead HTML
export function renderLetterheadHTML(letterhead: LetterheadConfig): string {
  if (!letterhead?.enabled || !letterhead.lines || letterhead.lines.length === 0) {
    return '';
  }

  const alignment = letterhead.alignment || 'center';
  
  // Logo kiri dan kanan
  const logoKiriElement = letterhead.logoLeftUrl ? 
    `<img src="${letterhead.logoLeftUrl}" style="height:80px;object-fit:contain;float:left;margin-right:20px;" alt="Logo Kiri" />` : '';
  
  const logoKananElement = letterhead.logoRightUrl ? 
    `<img src="${letterhead.logoRightUrl}" style="height:80px;object-fit:contain;float:right;margin-left:20px;" alt="Logo Kanan" />` : '';
  
  const lines = letterhead.lines
    .filter(line => {
      return line.text.trim().length > 0;
    })
    .map((line, index) => {
      const text = line.text;
      const fontWeight = line.fontWeight;
      const style = fontWeight === 'bold' ? 'font-weight:bold;font-size:18px;' : 'font-size:14px;';
      return `<div style="${style}">${escapeHtml(text)}</div>`;
    })
    .join('');

  return `
    <div style="margin-bottom:20px;overflow:hidden;">
      ${logoKiriElement}
      ${logoKananElement}
      <div style="text-align:${alignment};clear:both;">
        ${lines}
      </div>
    </div>
    <hr style="margin:20px 0;border:1px solid #ddd;" />
  `;
}

// Utility function untuk escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility function untuk mendapatkan konfigurasi kop dengan fallback
export function getLetterheadConfig(reportKey?: string): LetterheadConfig {
  const cacheKey = reportKey || 'global';
  return letterheadCache.get(cacheKey) || DEFAULT_LETTERHEAD;
}

// Utility function untuk clear cache (untuk testing atau refresh manual)
export function clearLetterheadCache(reportKey?: string): void {
  if (reportKey) {
    letterheadCache.delete(reportKey);
    cacheTimestamps.delete(reportKey);
  } else {
    letterheadCache.clear();
    cacheTimestamps.clear();
  }
}
