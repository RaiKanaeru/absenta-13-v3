import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, RotateCcw, Eye, Upload, Trash2 } from "lucide-react";
import { REPORT_KEYS_OPTIONS } from "@/utils/reportKeys";
import { getApiUrl } from "@/config/api";

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

interface ReportLetterheadSettingsProps {
  onBack: () => void;
  onLogout: () => void;
}

const DEFAULT_LETTERHEAD: LetterheadConfig = {
  enabled: true,
  logo: "",
  logoLeftUrl: "",
  logoRightUrl: "",
  lines: [
    { text: "PEMERINTAH DAERAH PROVINSI DKI JAKARTA", fontWeight: "bold" },
    { text: "DINAS PENDIDIKAN", fontWeight: "bold" },
    { text: "SMK NEGERI 13 JAKARTA", fontWeight: "bold" },
    { text: "Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910", fontWeight: "normal" }
  ],
  alignment: "center"
};

export default function ReportLetterheadSettings({ onBack, onLogout }: ReportLetterheadSettingsProps) {
  const [config, setConfig] = useState<LetterheadConfig>(DEFAULT_LETTERHEAD);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [scope, setScope] = useState<ScopeType>('global');
  const [selectedReportKey, setSelectedReportKey] = useState<string>('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoLeftFile, setLogoLeftFile] = useState<File | null>(null);
  const [logoLeftPreview, setLogoLeftPreview] = useState<string>("");
  const [logoRightFile, setLogoRightFile] = useState<File | null>(null);
  const [logoRightPreview, setLogoRightPreview] = useState<string>("");

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Reload config when scope or reportKey changes
  useEffect(() => {
    if (scope === 'report' && selectedReportKey) {
      loadConfig();
    } else if (scope === 'global') {
      loadConfig();
    }
  }, [scope, selectedReportKey]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log('🔍 Loading letterhead config:', { token: token ? 'present' : 'missing', scope, selectedReportKey });
      
      const url = scope === 'global' 
        ? getApiUrl('/api/admin/letterhead')
        : getApiUrl(`/api/admin/letterhead?reportKey=${selectedReportKey}`);
        
      console.log('🔍 Fetching URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      console.log('🔍 Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Response data:', data);
        if (data.success) {
          // Handle backward compatibility - convert old format to new format
          const configData = data.data;
          if (configData.lines && Array.isArray(configData.lines)) {
            // Check if lines are strings (old format) or objects (new format)
            if (typeof configData.lines[0] === 'string') {
              // Convert old format to new format
              configData.lines = configData.lines.map((line: string, index: number) => ({
                text: line,
                fontWeight: index === 0 ? 'bold' : 'normal' // First line is bold by default
              }));
            }
          }
          setConfig(configData);
          // Set preview untuk logo yang sudah ada
          if (configData.logo) {
            setLogoPreview(configData.logo);
          }
          if (configData.logoLeftUrl) {
            setLogoLeftPreview(configData.logoLeftUrl);
          }
          if (configData.logoRightUrl) {
            setLogoRightPreview(configData.logoRightUrl);
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Failed to load letterhead config:', response.status, errorData);
        toast({
          title: "Error",
          description: errorData.error || `Gagal memuat konfigurasi kop laporan (${response.status})`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading letterhead config:', error);
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat memuat konfigurasi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      // Upload files to server first
      let logoUrl = config.logo || "";
      let logoLeftUrl = config.logoLeftUrl || "";
      let logoRightUrl = config.logoRightUrl || "";

      // Upload logo tengah
      if (logoFile) {
        const logoUploadResult = await uploadLogoFile(logoFile, 'logo');
        if (logoUploadResult.success) {
          logoUrl = logoUploadResult.data.url;
        } else {
          throw new Error(logoUploadResult.error || 'Gagal upload logo tengah');
        }
      }

      // Upload logo kiri
      if (logoLeftFile) {
        const logoLeftUploadResult = await uploadLogoFile(logoLeftFile, 'logoLeft');
        if (logoLeftUploadResult.success) {
          logoLeftUrl = logoLeftUploadResult.data.url;
        } else {
          throw new Error(logoLeftUploadResult.error || 'Gagal upload logo kiri');
        }
      }

      // Upload logo kanan
      if (logoRightFile) {
        const logoRightUploadResult = await uploadLogoFile(logoRightFile, 'logoRight');
        if (logoRightUploadResult.success) {
          logoRightUrl = logoRightUploadResult.data.url;
        } else {
          throw new Error(logoRightUploadResult.error || 'Gagal upload logo kanan');
        }
      }

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
      console.error('Error saving letterhead config:', error);
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
        const currentUrl = logoType === 'logo' ? config.logo : 
                          logoType === 'logoLeft' ? config.logoLeftUrl : 
                          config.logoRightUrl;
        
        if (currentUrl && currentUrl.startsWith('/uploads/letterheads/')) {
          try {
            await deleteOldLogoFile(currentUrl);
          } catch (deleteError) {
            console.warn('Could not delete old file:', deleteError);
            // Continue with upload even if old file deletion fails
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
      console.error('Error uploading logo:', error);
      return {
        success: false,
        error: 'Terjadi kesalahan saat upload file'
      };
    }
  };

  const deleteOldLogoFile = async (fileUrl: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/admin/letterhead/delete-file'), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ fileUrl })
      });

      if (response.ok) {
        console.log('✅ Old file deleted successfully');
      } else {
        console.warn('⚠️ Could not delete old file');
      }
    } catch (error) {
      console.warn('⚠️ Error deleting old file:', error);
    }
  };


  const handleDeleteLogo = async (logoType: 'logo' | 'logoLeft' | 'logoRight') => {
    try {
      const token = localStorage.getItem('token');
      const url = getApiUrl(`/api/admin/letterhead/logo/${logoType}?scope=${scope}${scope === 'report' ? `&reportKey=${selectedReportKey}` : ''}`);
      
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
            [logoType === 'logo' ? 'logo' : logoType === 'logoLeft' ? 'logoLeftUrl' : 'logoRightUrl']: ''
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
      console.error('Error deleting logo:', error);
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

  const renderPreview = () => {
    if (!config.enabled) return null;

    const alignment = config.alignment || 'center';
    
    // Helper to get correct image source
    const getImageSrc = (src: string) => {
      if (!src) return "";
      if (src.startsWith('data:')) return src; // Base64
      if (src.startsWith('http')) return src; // Full URL
      if (src.startsWith('/')) return getApiUrl(src); // Relative path from API
      return src;
    };

    // Logo tengah
    const logoSrc = getImageSrc(config.logo || logoPreview);
    const logoElement = logoSrc ?
      <img src={logoSrc} alt="Logo Tengah" className="h-16 object-contain mx-auto mb-4" /> : null;
    
    // Logo kiri dan kanan
    const logoLeftSrc = getImageSrc(config.logoLeftUrl || logoLeftPreview);
    const logoLeftElement = logoLeftSrc ?
      <img src={logoLeftSrc} alt="Logo Kiri" className="h-20 object-contain float-left mr-5" /> : null;
    
    const logoRightSrc = getImageSrc(config.logoRightUrl || logoRightPreview);
    const logoRightElement = logoRightSrc ?
      <img src={logoRightSrc} alt="Logo Kanan" className="h-20 object-contain float-right ml-5" /> : null;

    return (
      <div className="border rounded-lg p-6 bg-white mt-4">
        <div className="overflow-hidden pt-4">
          {logoLeftElement}
          {logoRightElement}
          <div className={`text-${alignment} space-y-1 clear-both`}>
            {logoElement}
            {config.lines.map((line, index) => (
              <div key={index} className={`${line.fontWeight === 'bold' ? 'font-bold' : 'font-normal'} text-sm`}>
                {line.text || `Baris ${index + 1}`}
              </div>
            ))}
          </div>
        </div>
        <hr className="my-4" />
        <div className="text-center">
          <div className="font-bold text-lg">CONTOH JUDUL LAPORAN</div>
          <div className="text-sm text-gray-600">Periode: 01 Januari 2025 - 31 Januari 2025</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Memuat konfigurasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Pengaturan Kop Laporan</h1>
                <p className="text-sm text-gray-600">Kelola header/kop untuk semua laporan sistem</p>
              </div>
            </div>
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Konfigurasi Kop Laporan</CardTitle>
                <CardDescription>
                  Atur header/kop yang akan digunakan di semua laporan (cetak HTML dan ekspor Excel)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Scope Selection */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="scope">Cakupan KOP</Label>
                    <p className="text-sm text-gray-600">Pilih apakah KOP berlaku global atau per jenis laporan</p>
                  </div>
                  <Select value={scope} onValueChange={(value: ScopeType) => setScope(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih cakupan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (Semua Laporan)</SelectItem>
                      <SelectItem value="report">Per Jenis Laporan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Report Key Selection */}
                {scope === 'report' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="reportKey">Jenis Laporan</Label>
                      <p className="text-sm text-gray-600">Pilih jenis laporan yang akan dikonfigurasi</p>
                    </div>
                    <Select value={selectedReportKey} onValueChange={setSelectedReportKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis laporan" />
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

                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enabled">Aktifkan Kop Laporan</Label>
                    <p className="text-sm text-gray-600">Tampilkan kop di semua laporan</p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>

                {/* Logo Upload */}
                <div className="space-y-4">
                  {/* Logo Tengah */}
                  <div className="space-y-2">
                    <Label htmlFor="logo">Logo Tengah (Opsional)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="flex-1"
                      />
                      <Button variant="outline" size="sm" onClick={() => document.getElementById('logo')?.click()}>
                        <Upload className="h-4 w-4" />
                      </Button>
                      {(config.logo || logoPreview) && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDeleteLogo('logo')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="logoLeft">Logo Kiri (Opsional)</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="logoLeft"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoLeftChange}
                          className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={() => document.getElementById('logoLeft')?.click()}>
                          <Upload className="h-4 w-4" />
                        </Button>
                        {(config.logoLeftUrl || logoLeftPreview) && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleDeleteLogo('logoLeft')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logoRight">Logo Kanan (Opsional)</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="logoRight"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoRightChange}
                          className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={() => document.getElementById('logoRight')?.click()}>
                          <Upload className="h-4 w-4" />
                        </Button>
                        {(config.logoRightUrl || logoRightPreview) && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleDeleteLogo('logoRight')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Format: JPG, PNG, GIF. Maksimal 2MB per file</p>
                </div>

                {/* Alignment */}
                <div className="space-y-2">
                  <Label htmlFor="alignment">Posisi Teks</Label>
                  <Select
                    value={config.alignment}
                    onValueChange={(value: 'left' | 'center' | 'right') => 
                      setConfig(prev => ({ ...prev, alignment: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Kiri</SelectItem>
                      <SelectItem value="center">Tengah</SelectItem>
                      <SelectItem value="right">Kanan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Text Lines */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Baris Teks</Label>
                    <Button variant="outline" size="sm" onClick={addLine}>
                      Tambah Baris
                    </Button>
                  </div>
                  
                  {config.lines.map((line, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Input
                          value={line.text}
                          onChange={(e) => updateLine(index, e.target.value)}
                          placeholder={`Baris ${index + 1}`}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeLine(index)}
                          disabled={config.lines.length <= 1}
                        >
                          Hapus
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label className="text-sm text-gray-600">Font Weight:</Label>
                        <Select
                          value={line.fontWeight}
                          onValueChange={(value: 'normal' | 'bold') => updateLineFontWeight(index, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Biasa</SelectItem>
                            <SelectItem value="bold">Tebal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                  
                  <p className="text-xs text-gray-500">
                    Baris pertama biasanya nama instansi (akan ditampilkan tebal)
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Simpan
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Preview Kop Laporan</CardTitle>
                    <CardDescription>Pratinjau tampilan kop laporan</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {previewMode ? 'Sembunyikan' : 'Tampilkan'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {previewMode ? (
                  renderPreview()
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Klik "Tampilkan" untuk melihat preview
                  </div>
                )}
                
                {/* Logo Previews */}
                {(config.logo || logoPreview || config.logoLeftUrl || logoLeftPreview || config.logoRightUrl || logoRightPreview) && (
                  <div className="mt-6 space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Logo yang Terupload:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(config.logo || logoPreview) && (
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-2">Logo Tengah</p>
                          <img 
                            src={config.logo || logoPreview} 
                            alt="Logo Tengah" 
                            className="h-16 object-contain mx-auto border rounded"
                          />
                          {config.logo && (
                            <p className="text-xs text-gray-400 mt-1">
                              File: {config.logo.split('/').pop()}
                            </p>
                          )}
                        </div>
                      )}
                      {(config.logoLeftUrl || logoLeftPreview) && (
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-2">Logo Kiri</p>
                          <img 
                            src={config.logoLeftUrl || logoLeftPreview} 
                            alt="Logo Kiri" 
                            className="h-16 object-contain mx-auto border rounded"
                          />
                          {config.logoLeftUrl && (
                            <p className="text-xs text-gray-400 mt-1">
                              File: {config.logoLeftUrl.split('/').pop()}
                            </p>
                          )}
                        </div>
                      )}
                      {(config.logoRightUrl || logoRightPreview) && (
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-2">Logo Kanan</p>
                          <img 
                            src={config.logoRightUrl || logoRightPreview} 
                            alt="Logo Kanan" 
                            className="h-16 object-contain mx-auto border rounded"
                          />
                          {config.logoRightUrl && (
                            <p className="text-xs text-gray-400 mt-1">
                              File: {config.logoRightUrl.split('/').pop()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info */}
            <Alert>
              <AlertDescription>
                <strong>Catatan:</strong> Kop laporan ini akan diterapkan ke semua laporan di sistem, 
                termasuk laporan cetak HTML dan ekspor Excel di halaman Admin dan Guru.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}
