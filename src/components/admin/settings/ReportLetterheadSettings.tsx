import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Save, RotateCcw, Eye, EyeOff, Upload, Trash2, Plus, GripVertical, FileImage, Globe, FileText, AlignLeft, AlignCenter, AlignRight, Info } from "lucide-react";
import { REPORT_KEYS_OPTIONS } from "@/utils/reportKeys";
import { getApiUrl } from "@/config/api";
import { cn } from "@/lib/utils";

interface LetterheadConfig {
  enabled: boolean;
  logo: string;
  logoLeftUrl: string;
  logoRightUrl: string;
  lines: Array<{
    text: string;
    fontWeight: 'normal' | 'bold';
  }>;
  alignment: 'left' | 'center' | 'right';
}

type ScopeType = 'global' | 'report';

// Menggunakan REPORT_KEYS_OPTIONS dari utils

const DEFAULT_LETTERHEAD: LetterheadConfig = {
  enabled: true,
  logo: "",
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

/**
 * Parse letterhead config data - handles backward compatibility
 * @param configData Raw config data from API
 * @returns Normalized LetterheadConfig
 */
function parseLetterheadConfig(configData: LetterheadConfig): LetterheadConfig {
  if (!configData.lines || !Array.isArray(configData.lines)) {
    return configData;
  }
  
  // Check if lines are strings (old format) or objects (new format)
  if (typeof configData.lines[0] === 'string') {
    // Convert old format to new format
    configData.lines = configData.lines.map((line: string | { text: string; fontWeight: 'normal' | 'bold' }, index: number) => ({
      text: typeof line === 'string' ? line : line.text,
      fontWeight: index === 0 ? 'bold' as const : 'normal' as const
    }));
  }
  
  return configData;
}

// ─── Logo Upload Zone Component ─────────────────────────────────────────────

interface LogoUploadZoneProps {
  id: string;
  label: string;
  preview: string;
  configUrl: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
  getImageSrc: (src: string) => string;
}

function LogoUploadZone({ id, label, preview, configUrl, onChange, onDelete, getImageSrc }: LogoUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasImage = configUrl || preview;
  const displaySrc = hasImage ? getImageSrc(configUrl || preview) : '';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const syntheticEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <input
        id={id}
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="sr-only"
      />
      {hasImage ? (
        <div className="relative group rounded-xl border-2 border-border bg-muted/30 p-3 flex items-center gap-3 transition-all duration-200 hover:border-primary/40 hover:bg-muted/50">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-white border border-border/50 flex items-center justify-center flex-shrink-0 shadow-sm">
            <img src={displaySrc} alt={label} className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {configUrl ? configUrl.split('/').pop() : 'File baru (belum disimpan)'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Siap digunakan</p>
          </div>
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
            "flex flex-col items-center justify-center gap-2 py-6 px-4",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/60 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <div className={cn(
            "rounded-full p-2.5 transition-colors",
            isDragging ? "bg-primary/10" : "bg-muted"
          )}>
            <FileImage className={cn("h-4 w-4", isDragging ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-foreground">Klik atau drag &amp; drop</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, GIF · Maks. 2MB</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReportLetterheadSettings() {
  const [config, setConfig] = useState<LetterheadConfig>(DEFAULT_LETTERHEAD);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [scope, setScope] = useState<ScopeType>('global');
  const [selectedReportKey, setSelectedReportKey] = useState<string>('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoLeftFile, setLogoLeftFile] = useState<File | null>(null);
  const [logoLeftPreview, setLogoLeftPreview] = useState<string>("");
  const [logoRightFile, setLogoRightFile] = useState<File | null>(null);
  const [logoRightPreview, setLogoRightPreview] = useState<string>("");

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const url = scope === 'global' 
        ? getApiUrl('/api/admin/letterhead')
        : getApiUrl(`/api/admin/letterhead?reportKey=${selectedReportKey}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const configData = parseLetterheadConfig(data.data);
          setConfig(configData);
          
          // Set preview untuk logo yang sudah ada
          if (configData.logo) setLogoPreview(configData.logo);
          if (configData.logoLeftUrl) setLogoLeftPreview(configData.logoLeftUrl);
          if (configData.logoRightUrl) setLogoRightPreview(configData.logoRightUrl);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast({
          title: "Error",
          description: errorData.error || `Gagal memuat konfigurasi kop laporan (${response.status})`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Operation failed:', error);
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat memuat konfigurasi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [scope, selectedReportKey]);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Reload config when scope or reportKey changes
  useEffect(() => {
    // Both scopes need config reload when dependencies change
    if (scope === 'global' || (scope === 'report' && selectedReportKey)) {
      loadConfig();
    }
  }, [scope, selectedReportKey, loadConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      // Upload files to server first
      let logoUrl = config.logo || "";
      let logoLeftUrl = config.logoLeftUrl || "";
      let logoRightUrl = config.logoRightUrl || "";

      // Helper to upload a single logo file
      const uploadSingleLogo = async (file: File | null, logoType: string, fallback: string) => {
        if (!file) return fallback;
        const result = await uploadLogoFile(file, logoType);
        if (!result.success) throw new Error(result.error || `Gagal upload ${logoType}`);
        return result.data.url;
      };

      // Upload all logos
      logoUrl = await uploadSingleLogo(logoFile, 'logo', logoUrl);
      logoLeftUrl = await uploadSingleLogo(logoLeftFile, 'logoLeft', logoLeftUrl);
      logoRightUrl = await uploadSingleLogo(logoRightFile, 'logoRight', logoRightUrl);

      const configToSave = {
        ...config,
        logo: logoUrl,
        logoLeftUrl: logoLeftUrl,
        logoRightUrl: logoRightUrl
      };

      const url = scope === 'global' 
        ? getApiUrl('/api/admin/letterhead/global')
        : getApiUrl(`/api/admin/letterhead/report/${selectedReportKey}`);
        
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(configToSave)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: "Berhasil",
            description: "Konfigurasi kop laporan berhasil disimpan"
          });
          setConfig(configToSave);
          setLogoPreview(logoUrl);
          setLogoLeftPreview(logoLeftUrl);
          setLogoRightPreview(logoRightUrl);
          
          // Clear file states after successful upload
          setLogoFile(null);
          setLogoLeftFile(null);
          setLogoRightFile(null);
        } else {
          throw new Error(data.error || 'Gagal menyimpan konfigurasi');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menyimpan konfigurasi');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_LETTERHEAD);
    setLogoFile(null);
    setLogoPreview("");
    setLogoLeftFile(null);
    setLogoLeftPreview("");
    setLogoRightFile(null);
    setLogoRightPreview("");
  };

  // Helper to get config key from logo type (S3776 compliance - avoid nested ternary)
  const getLogoConfigKey = (logoType: string): string => {
    const keyMap: Record<string, string> = {
      'logo': 'logo',
      'logoLeft': 'logoLeftUrl',
      'logoRight': 'logoRightUrl'
    };
    return keyMap[logoType] || 'logo';
  };

  const convertFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadLogoFile = async (file: File, logoType: string) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('logoType', logoType);

      const response = await fetch(getApiUrl('/api/admin/letterhead/upload'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        // Delete old file if exists
        // Helper to get current logo URL based on type
        const getLogoUrl = () => {
          if (logoType === 'logo') return config.logo;
          if (logoType === 'logoLeft') return config.logoLeftUrl;
          return config.logoRightUrl;
        };
        const currentUrl = getLogoUrl();
        
        if (currentUrl?.startsWith('/uploads/letterheads/')) {
          try {
            await deleteOldLogoFile(currentUrl);
          } catch (deleteError) {
            // Old file deletion failed, continue with upload
            // Continue with upload even if old file deletion fails
            console.error('ReportLetterheadSettings: Failed to delete old logo file', deleteError);
          }
        }
        
        return {
          success: true,
          data: result.data
        };
      } else {
        return {
          success: false,
          error: result.error || 'Gagal upload file'
        };
      }
    } catch (error) {
      console.error('Operation failed:', error);
      return {
        success: false,
        error: 'Terjadi kesalahan saat upload file'
      };
    }
  };

  const deleteOldLogoFile = async (fileUrl: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(getApiUrl('/api/admin/letterhead/delete-file'), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ fileUrl })
      });
    } catch (error) {
      // Old file deletion error, non-critical
      console.error('ReportLetterheadSettings: Failed to delete old letterhead file', error);
    }
  };


  const handleDeleteLogo = async (logoType: 'logo' | 'logoLeft' | 'logoRight') => {
    try {
      const token = localStorage.getItem('token');
      const reportKeyQuery = scope === 'report' ? `&reportKey=${selectedReportKey}` : '';
      const url = getApiUrl(`/api/admin/letterhead/logo/${logoType}?scope=${scope}${reportKeyQuery}`);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast({
            title: "Berhasil",
            description: `Logo ${logoType} berhasil dihapus`
          });
          
          // Update state
          setConfig(prev => ({
            ...prev,
            [getLogoConfigKey(logoType)]: ''
          }));
          
          // Clear preview
          if (logoType === 'logo') {
            setLogoPreview('');
            setLogoFile(null);
          } else if (logoType === 'logoLeft') {
            setLogoLeftPreview('');
            setLogoLeftFile(null);
          } else if (logoType === 'logoRight') {
            setLogoRightPreview('');
            setLogoRightFile(null);
          }
        } else {
          throw new Error(data.error || 'Gagal menghapus logo');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menghapus logo');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat menghapus logo",
        variant: "destructive"
      });
    }
  };

  const handleLogoLeftChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "Error",
          description: "Ukuran file logo kiri maksimal 2MB",
          variant: "destructive"
        });
        return;
      }
      
      setLogoLeftFile(file);
      convertFileToDataUrl(file).then(setLogoLeftPreview);
    }
  };

  const handleLogoRightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "Error",
          description: "Ukuran file logo kanan maksimal 2MB",
          variant: "destructive"
        });
        return;
      }
      
      setLogoRightFile(file);
      convertFileToDataUrl(file).then(setLogoRightPreview);
    }
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "Error",
          description: "Ukuran file logo tengah maksimal 2MB",
          variant: "destructive"
        });
        return;
      }
      
      setLogoFile(file);
      // Use base64 for preview only
      convertFileToDataUrl(file).then(setLogoPreview);
    }
  };

  const addLine = () => {
    setConfig(prev => ({
      ...prev,
      lines: [...prev.lines, { text: "", fontWeight: "normal" }]
    }));
  };

  const removeLine = (index: number) => {
    setConfig(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const updateLine = (index: number, value: string) => {
    setConfig(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, text: value } : line)
    }));
  };

  const updateLineFontWeight = (index: number, fontWeight: 'normal' | 'bold') => {
    setConfig(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, fontWeight } : line)
    }));
  };

  // Helper to get correct image source - Moved to component level
  const getImageSrc = (src: string) => {
    if (!src) return "";
    if (src.startsWith('data:')) return src; // Base64
    if (src.startsWith('http')) return src; // Full URL
    if (src.startsWith('/')) return getApiUrl(src); // Relative path from API
    // Fallback for bare filenames - assume they are in uploads/letterheads/
    return getApiUrl(`/uploads/letterheads/${src}`);
  };

  const renderPreview = () => {
    if (!config.enabled) return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <div className="rounded-full bg-muted p-3">
          <EyeOff className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Kop Laporan Dinonaktifkan</p>
        <p className="text-xs text-center max-w-[200px]">Aktifkan kop laporan di panel pengaturan untuk melihat preview</p>
      </div>
    );

    const alignment = config.alignment || 'center';

    // Logo tengah
    const logoSrc = getImageSrc(config.logo || logoPreview);
    const logoElement = logoSrc ?
      <img src={logoSrc} alt="Logo Tengah" className="h-14 object-contain mx-auto mb-3" /> : null;
    
    // Logo kiri dan kanan
    const logoLeftSrc = getImageSrc(config.logoLeftUrl || logoLeftPreview);
    const logoLeftElement = logoLeftSrc ?
      <img src={logoLeftSrc} alt="Logo Kiri" className="h-16 object-contain float-left mr-4" /> : null;
    
    const logoRightSrc = getImageSrc(config.logoRightUrl || logoRightPreview);
    const logoRightElement = logoRightSrc ?
      <img src={logoRightSrc} alt="Logo Kanan" className="h-16 object-contain float-right ml-4" /> : null;

    return (
      <div className="rounded-xl border-2 border-border/60 bg-white dark:bg-card shadow-sm overflow-hidden">
        {/* Letterhead area */}
        <div className="px-6 pt-5 pb-4 border-b border-border/40">
          <div className="overflow-hidden">
            {logoLeftElement}
            {logoRightElement}
            <div className={cn("space-y-0.5 clear-both", `text-${alignment}`)}>
              {logoElement}
              {config.lines.map((line, index) => (
                <div
                  key={`line-preview-${line.text?.slice(0, 10) || 'empty'}-${line.fontWeight || 'normal'}-${(line.text || '').length}`}
                  className={cn(
                    "text-xs leading-snug",
                    line.fontWeight === 'bold' ? 'font-bold text-foreground' : 'font-normal text-muted-foreground'
                  )}
                >
                  {line.text || <span className="italic opacity-40">Baris {index + 1}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Separator line */}
        <div className="px-6 py-1">
          <div className="border-t-2 border-foreground/80" />
          <div className="border-t border-foreground/20 mt-0.5" />
        </div>
        {/* Sample content */}
        <div className="px-6 pb-5 pt-3 text-center">
          <div className="font-bold text-sm text-foreground">CONTOH JUDUL LAPORAN</div>
          <div className="text-xs text-muted-foreground mt-1">Periode: 01 Januari 2025 – 31 Januari 2025</div>
          <div className="mt-4 grid grid-cols-3 gap-2 opacity-30">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-2 bg-muted-foreground/40 rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Memuat konfigurasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Page Header ── */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-5 gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Pengaturan Kop Laporan</h1>
              <p className="text-sm text-muted-foreground">Kelola header/kop untuk semua laporan sistem</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 min-w-[110px]"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">

          {/* ══ LEFT: Configuration Form ══ */}
          <div className="xl:col-span-3 space-y-5">

            {/* ── Section: Scope ── */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-4 bg-muted/30 border-b">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-primary/10 p-1.5">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Cakupan Kop</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Pilih apakah kop berlaku global atau per jenis laporan</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {/* Scope selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('global')}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3.5 text-left transition-all duration-150",
                      scope === 'global'
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Globe className={cn("h-4 w-4", scope === 'global' ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-semibold", scope === 'global' ? "text-primary" : "text-foreground")}>Global</span>
                      {scope === 'global' && <Badge className="ml-auto text-[10px] py-0 h-4">Aktif</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">Berlaku untuk semua laporan</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('report')}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3.5 text-left transition-all duration-150",
                      scope === 'report'
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <FileText className={cn("h-4 w-4", scope === 'report' ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-semibold", scope === 'report' ? "text-primary" : "text-foreground")}>Per Laporan</span>
                      {scope === 'report' && <Badge className="ml-auto text-[10px] py-0 h-4">Aktif</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">Konfigurasi per jenis laporan</p>
                  </button>
                </div>

                {/* Report key selector */}
                {scope === 'report' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="reportKey" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jenis Laporan</Label>
                    <Select value={selectedReportKey} onValueChange={setSelectedReportKey}>
                      <SelectTrigger id="reportKey" className="h-10">
                        <SelectValue placeholder="Pilih jenis laporan..." />
                      </SelectTrigger>
                      <SelectContent>
                        {REPORT_KEYS_OPTIONS.map((report) => (
                          <SelectItem key={report.value} value={report.value}>
                            {report.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Section: General Settings ── */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-4 bg-muted/30 border-b">
                <CardTitle className="text-base">Pengaturan Umum</CardTitle>
                <CardDescription className="text-xs">Aktifkan kop dan tentukan posisi teks</CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                {/* Enable toggle */}
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/30">
                  <div className="space-y-0.5">
                    <Label htmlFor="enabled" className="text-sm font-medium cursor-pointer">Aktifkan Kop Laporan</Label>
                    <p className="text-xs text-muted-foreground">Tampilkan kop di semua laporan cetak &amp; Excel</p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>

                <Separator />

                {/* Alignment */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posisi Teks</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['left', 'center', 'right'] as const).map((align) => {
                      const icons = { left: AlignLeft, center: AlignCenter, right: AlignRight };
                      const labels = { left: 'Kiri', center: 'Tengah', right: 'Kanan' };
                      const Icon = icons[align];
                      return (
                        <button
                          key={align}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, alignment: align }))}
                          className={cn(
                            "flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 px-3 text-sm font-medium transition-all duration-150",
                            config.alignment === align
                              ? "border-primary bg-primary/5 text-primary shadow-sm"
                              : "border-border bg-muted/20 text-muted-foreground hover:border-border/80 hover:text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {labels[align]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Section: Logo Upload ── */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-4 bg-muted/30 border-b">
                <CardTitle className="text-base">Upload Logo</CardTitle>
                <CardDescription className="text-xs">Tambahkan logo instansi pada kop laporan</CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {/* Logo Tengah */}
                <LogoUploadZone
                  id="logo"
                  label="Logo Tengah (Opsional)"
                  preview={logoPreview}
                  configUrl={config.logo}
                  onChange={handleLogoChange}
                  onDelete={() => handleDeleteLogo('logo')}
                  getImageSrc={getImageSrc}
                />

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Logo Kiri */}
                  <LogoUploadZone
                    id="logoLeft"
                    label="Logo Kiri (Opsional)"
                    preview={logoLeftPreview}
                    configUrl={config.logoLeftUrl}
                    onChange={handleLogoLeftChange}
                    onDelete={() => handleDeleteLogo('logoLeft')}
                    getImageSrc={getImageSrc}
                  />

                  {/* Logo Kanan */}
                  <LogoUploadZone
                    id="logoRight"
                    label="Logo Kanan (Opsional)"
                    preview={logoRightPreview}
                    configUrl={config.logoRightUrl}
                    onChange={handleLogoRightChange}
                    onDelete={() => handleDeleteLogo('logoRight')}
                    getImageSrc={getImageSrc}
                  />
                </div>

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3 w-3 flex-shrink-0" />
                  Format: JPG, PNG, GIF · Maksimal 2MB per file
                </p>
              </CardContent>
            </Card>

            {/* ── Section: Text Lines ── */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-4 bg-muted/30 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Baris Teks Kop</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Atur baris teks yang muncul di kop laporan</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Baris
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {config.lines.map((line, index) => (
                  <div
                    key={`line-edit-${line.text?.slice(0, 10) || 'empty'}-${line.fontWeight || 'normal'}-${(line.text || '').length}`}
                    className="group flex items-start gap-2 rounded-xl border border-border/50 bg-muted/10 p-3 transition-colors hover:bg-muted/20"
                  >
                    <div className="mt-2.5 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground/60 w-4 text-right flex-shrink-0">{index + 1}</span>
                        <Input
                          value={line.text}
                          onChange={(e) => updateLine(index, e.target.value)}
                          placeholder={`Baris ${index + 1}...`}
                          className="h-8 text-sm flex-1"
                        />
                      </div>
                      <div className="flex items-center justify-between pl-6">
                        <Select
                          value={line.fontWeight}
                          onValueChange={(value: 'normal' | 'bold') => updateLineFontWeight(index, value)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Biasa</SelectItem>
                            <SelectItem value="bold">Tebal</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => removeLine(index)}
                          disabled={config.lines.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {config.lines.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">Belum ada baris teks.</p>
                    <p className="text-xs mt-1">Klik "Tambah Baris" untuk menambahkan.</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground pt-1">
                  Baris pertama biasanya nama instansi (disarankan tebal)
                </p>
              </CardContent>
            </Card>

            {/* ── Action Buttons (mobile — bottom) ── */}
            <div className="flex gap-3 xl:hidden">
              <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Konfigurasi
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          {/* ══ RIGHT: Preview Panel ══ */}
          <div className="xl:col-span-2 space-y-4">
            <div className="xl:sticky xl:top-6 space-y-4">

              {/* Preview Card */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Preview Kop Laporan</CardTitle>
                      <CardDescription className="text-xs mt-0.5">Pratinjau tampilan kop laporan secara langsung</CardDescription>
                    </div>
                    <Button
                      variant={previewMode ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setPreviewMode(!previewMode)}
                      className="gap-1.5 h-8 text-xs"
                    >
                      {previewMode ? (
                        <><EyeOff className="h-3.5 w-3.5" />Sembunyikan</>
                      ) : (
                        <><Eye className="h-3.5 w-3.5" />Tampilkan</>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {previewMode ? (
                    renderPreview()
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                      <div className="rounded-full bg-muted p-3">
                        <Eye className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium">Preview Disembunyikan</p>
                      <p className="text-xs text-center">Klik "Tampilkan" untuk melihat preview kop laporan</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Info Alert */}
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/40">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-xs text-blue-800 dark:text-blue-300 ml-2">
                  <strong>Catatan:</strong> Kop laporan ini akan diterapkan ke semua laporan di sistem,
                  termasuk laporan cetak HTML dan ekspor Excel di halaman Admin dan Guru.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
