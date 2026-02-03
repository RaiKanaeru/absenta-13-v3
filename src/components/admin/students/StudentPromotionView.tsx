import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { 
  ArrowLeft, RefreshCw, CheckCircle, Users, ArrowUpCircle, 
  ArrowRight, Home, Eye
} from "lucide-react";
import { StudentData, Kelas } from '@/types/dashboard';

// =============================================================================
// CLASS PARSING HELPER FUNCTIONS (Extracted to reduce Cognitive Complexity)
// =============================================================================

/** Mapping jurusan untuk kompatibilitas */
const MAJOR_MAPPING: Record<string, string> = {
  'KA': 'AK',
  'KEJURUAN': 'AK',
  'KEJURUANAN': 'AK',
  'KEJURUAN_AN': 'AK',
  'KEJURUAN-AN': 'AK'
};

/** Daftar jurusan yang valid */
const VALID_MAJORS = 'IPA|IPS|BAHASA|AGAMA|UMUM|TEKNIK|MULTIMEDIA|TKJ|RPL|AKUNTANSI|PEMASARAN|ADMINISTRASI|KEBIDANAN|KEPERAWATAN|FARMASI|KIMIA|FISIKA|BIOLOGI|MATEMATIKA|BHS|BAHASA|SOSIAL|EKONOMI|SEJARAH|GEOGRAFI|SENI|OLAHRAGA|PENDIDIKAN|GURU|SISWA|KA|KEJURUAN|KEJURUANAN|KEJURUAN_AN|KEJURUAN-AN|AK';

/** Konversi angka ke romawi */
const convertLevelToRoman = (level: string): string => {
  if (level === '10') return 'X';
  if (level === '11') return 'XI';
  if (level === '12') return 'XII';
  return level;
};

/** Terapkan mapping jurusan */
const applyMajorMapping = (major: string): string => {
  return MAJOR_MAPPING[major] || major;
};

/** Pattern untuk parsing nama kelas */
const CLASS_PATTERNS = [
  new RegExp(String.raw`^(X|XI|XII)\s+(${VALID_MAJORS})\s*(\d+)?$`),
  new RegExp(String.raw`^(10|11|12)\s+(${VALID_MAJORS})\s*(\d+)?$`),
  new RegExp(String.raw`^(X|XI|XII)\s+(${VALID_MAJORS})$`),
  new RegExp(String.raw`^(X|XI|XII)[\s\-_]+(${VALID_MAJORS})[\s\-_]*(\d+)?$`),
];

/** Fallback patterns untuk ekstrak tingkat */
const FALLBACK_PATTERNS = [/^(X|XI|XII)/, /^(10|11|12)/];
const MAJOR_EXTRACT_REGEX = new RegExp(`(${VALID_MAJORS})`);
const NUMBER_EXTRACT_REGEX = /(\d+)/;

interface ParsedClass {
  level: string;
  major: string;
  number: number;
  fullName: string;
}

/** Coba match dengan pattern utama */
const tryMatchPatterns = (cleanName: string, className: string): ParsedClass | null => {
  for (const pattern of CLASS_PATTERNS) {
    const match = pattern.exec(cleanName);
    if (match) {
      const level = convertLevelToRoman(match[1]);
      const major = applyMajorMapping(match[2]);
      const number = match[3] ? Number.parseInt(match[3]) : 1;
      return { level, major, number, fullName: className };
    }
  }
  return null;
};

/** Coba match dengan fallback pattern */
const tryFallbackMatch = (cleanName: string, className: string): ParsedClass | null => {
  for (const pattern of FALLBACK_PATTERNS) {
    const match = pattern.exec(cleanName);
    if (match) {
      const level = convertLevelToRoman(match[1]);
      const remaining = cleanName.replace(pattern, '').trim();
      
      const majorMatch = MAJOR_EXTRACT_REGEX.exec(remaining);
      const major = applyMajorMapping(majorMatch ? majorMatch[1] : 'UMUM');
      
      const numberMatch = NUMBER_EXTRACT_REGEX.exec(remaining);
      const number = numberMatch ? Number.parseInt(numberMatch[1]) : 1;
      
      return { level, major, number, fullName: className };
    }
  }
  return null;
};

// =============================================================================
// TARGET CLASS DETECTION HELPERS (Extracted to reduce Cognitive Complexity)
// =============================================================================

/** Dapatkan level tujuan dari level asal */
const getNextLevel = (currentLevel: string): string | null => {
  if (currentLevel === 'X') return 'XI';
  if (currentLevel === 'XI') return 'XII';
  return null; // XII tidak bisa dinaikkan
};

/** Cari kelas fallback berdasarkan tingkat dan jurusan */
const findFallbackByLevelAndMajor = (
  classes: Kelas[],
  targetLevel: string,
  major: string
): Kelas | null => {
  const found = classes.find(cls => {
    if ((cls as unknown as Record<string, string>).status !== 'aktif') return false;
    const name = cls.nama_kelas?.toUpperCase() || '';
    return name.includes(targetLevel) && name.includes(major);
  });
  return found || null;
};

/** Deteksi level sederhana dari nama kelas */
const detectSimpleLevel = (className: string): string | null => {
  const upper = className.toUpperCase();
  if (upper.includes('X ') && !upper.includes('XI') && !upper.includes('XII')) return 'XI';
  if (upper.includes('XI ') && !upper.includes('XII')) return 'XII';
  return null;
};

/** Cari kelas berdasarkan tingkat saja */
const findClassByLevel = (classes: Kelas[], targetLevel: string): Kelas | null => {
  const found = classes.find(cls => {
    if ((cls as unknown as Record<string, string>).status !== 'aktif') return false;
    return cls.nama_kelas?.toUpperCase().includes(targetLevel);
  });
  return found || null;
};

// =============================================================================

export const StudentPromotionView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [fromClassId, setFromClassId] = useState<string>('');
  const [toClassId, setToClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/kelas', { onLogout });
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast({ title: "Error memuat data kelas", description: getErrorMessage(error), variant: "destructive" });
    }
  }, [onLogout]);

  const fetchStudents = useCallback(async (classId: string) => {
    if (!classId) {
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiCall('/api/admin/students-data', { onLogout });

      // Guard: Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('Invalid data format from /api/admin/students-data:', data);
        setStudents([]);
        toast({ 
          title: "Error Format Data", 
          description: "Data siswa tidak dalam format yang benar", 
          variant: "destructive" 
        });
        return;
      }
      
      const filteredStudents = data.filter((student: StudentData) => {
        // Convert both to string for comparison
        const studentClassId = student.kelas_id?.toString();
        const targetClassId = classId.toString();
        const matches = studentClassId === targetClassId;
        return matches;
      });
      setStudents(filteredStudents);
      setSelectedStudents(new Set()); // Reset selection
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({ title: "Error memuat data siswa", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (fromClassId) {
      fetchStudents(fromClassId);
    } else {
      setStudents([]);
      setSelectedStudents(new Set());
    }
  }, [fromClassId, fetchStudents]);

  // SMART CLASS PARSER - Simplified using extracted helpers
  const parseClassName = useCallback((className: string): ParsedClass | null => {
    const cleanName = className.trim().toUpperCase();
    
    // Coba match dengan pattern utama
    const primaryMatch = tryMatchPatterns(cleanName, className);
    if (primaryMatch) return primaryMatch;
    
    // Fallback: coba ekstrak tingkat dari awal string
    return tryFallbackMatch(cleanName, className);
  }, []);

  // AUTO-DETECT TARGET CLASS - Otomatis cari kelas tujuan berdasarkan kelas asal
  const findTargetClass = useCallback((fromClassId: string) => {

    
    const sourceClass = classes.find(c => c.id?.toString() === fromClassId);
    if (!sourceClass) {
      return null;
    }
    
    const parsed = parseClassName(sourceClass.nama_kelas || '');
    if (!parsed) {
      return null;
    }
    
    // Tentukan tingkat tujuan
    let targetLevel = '';
    if (parsed.level === 'X') targetLevel = 'XI';
    else if (parsed.level === 'XI') targetLevel = 'XII';
    else {
      return null; // XII tidak bisa dinaikkan
    }
    
    // Cari kelas dengan tingkat tujuan, jurusan sama, nomor sama
    const targetClass = classes.find(cls => {
      const targetParsed = parseClassName(cls.nama_kelas || '');
      const isMatch = targetParsed &&
             targetParsed.level === targetLevel &&
             targetParsed.major === parsed.major &&
             targetParsed.number === parsed.number;
      return isMatch;
    });
    return targetClass || null;
  }, [classes, parseClassName]);

  // Helper: Handle fallback class detection when primary detection fails
  // Extracted to reduce Cognitive Complexity of useEffect (S3776 compliance)
  const handleFallbackClassDetection = useCallback((
    sourceClassId: string,
    setToClassIdFn: (id: string) => void
  ): void => {
    const sourceClass = classes.find(c => c.id?.toString() === sourceClassId);
    const sourceParsed = parseClassName(sourceClass?.nama_kelas || '');

    // Case 1: sourceParsed exists - try fallback by level and major
    if (sourceParsed) {
      const targetLevel = getNextLevel(sourceParsed.level);
      if (!targetLevel) {
        setToClassIdFn('');
        toast({ title: "Tidak Dapat Dipromosikan", description: "Siswa kelas XII sudah lulus", variant: "destructive" });
        return;
      }

      const fallbackClass = findFallbackByLevelAndMajor(classes, targetLevel, sourceParsed.major);
      if (fallbackClass) {
        setToClassIdFn(fallbackClass.id?.toString() || '');
        toast({ title: "Kelas Tujuan Ditemukan (Parsial)", description: `Mohon periksa: ${fallbackClass.nama_kelas}` });
        return;
      }

      setToClassIdFn('');
      toast({ title: "Kelas Tujuan Tidak Ditemukan", description: `Kelas ${targetLevel} ${sourceParsed.major} belum dibuat`, variant: "destructive" });
      return;
    }

    // Case 2: sourceParsed is null - try simple level detection
    if (sourceClass?.nama_kelas) {
      const simpleLevel = detectSimpleLevel(sourceClass.nama_kelas);
      if (simpleLevel) {
        const simpleFallback = findClassByLevel(classes, simpleLevel);
        if (simpleFallback) {
          setToClassIdFn(simpleFallback.id?.toString() || '');
          toast({ title: "Kelas Tujuan Ditemukan (Sederhana)", description: `Ditemukan: ${simpleFallback.nama_kelas}` });
          return;
        }
      }
    }

    setToClassIdFn('');
    toast({ title: "Kelas Tujuan Tidak Ditemukan", description: "Silakan buat kelas yang sesuai terlebih dahulu.", variant: "destructive" });
  }, [classes, parseClassName]);

  // Auto-detect dan set kelas tujuan saat kelas asal dipilih (Simplified)
  useEffect(() => {
    // Guard: no action if no class selected or no classes loaded
    if (!fromClassId) {
      setToClassId('');
      return;
    }
    if (classes.length === 0) return;

    // Try primary detection
    const targetClass = findTargetClass(fromClassId);
    if (targetClass) {
      setToClassId(targetClass.id?.toString() || '');
      const sourceClass = classes.find(c => c.id?.toString() === fromClassId);
      const sourceParsed = parseClassName(sourceClass?.nama_kelas || '');
      const targetParsed = parseClassName(targetClass.nama_kelas || '');
      if (sourceParsed && targetParsed) {
        toast({
          title: "Kelas Tujuan Terdeteksi",
          description: `${sourceParsed.level} ${sourceParsed.major} ${sourceParsed.number} → ${targetParsed.level} ${targetParsed.major} ${targetParsed.number}`,
        });
      }
      return;
    }
    // Fallback: Use extracted helper for detection
    handleFallbackClassDetection(fromClassId, setToClassId);
  }, [fromClassId, classes, findTargetClass, parseClassName, handleFallbackClassDetection]);

  // Reset states when fromClassId changes
  useEffect(() => {
    if (!fromClassId) {
      setStudents([]);
      setSelectedStudents(new Set());
      setToClassId('');
    }
  }, [fromClassId]);

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(student => student.id_siswa)));
    }
  };

  const handleSelectStudent = (studentId: number) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const handlePromotion = async () => {
    // Validasi state yang lebih ketat
    if (!fromClassId) {
      toast({ title: "Peringatan", description: "Pilih kelas asal terlebih dahulu", variant: "destructive" });
      return;
    }

    if (!toClassId) {
      toast({ title: "Peringatan", description: "Kelas tujuan tidak ditemukan atau tidak valid", variant: "destructive" });
      return;
    }

    if (selectedStudents.size === 0) {
      toast({ title: "Peringatan", description: "Pilih minimal satu siswa untuk dinaikkan kelas", variant: "destructive" });
      return;
    }

    // Validasi kelas asal tidak boleh kelas XII
    const sourceClass = classes.find(c => c.id?.toString() === fromClassId);
    if (sourceClass?.nama_kelas?.includes('XII')) {
      toast({ 
        title: "Tidak Dapat Dipromosikan", 
        description: "Siswa kelas XII sudah lulus dan tidak dapat dinaikkan kelas", 
        variant: "destructive" 
      });
      return;
    }

    // Validasi kelas tujuan harus berbeda dari kelas asal
    if (fromClassId === toClassId) {
      toast({ 
        title: "Peringatan", 
        description: "Kelas tujuan harus berbeda dari kelas asal", 
        variant: "destructive" 
      });
      return;
    }

    setIsProcessing(true);
    try {
      const studentIds = Array.from(selectedStudents);
      
      const response = await apiCall('/api/admin/student-promotion', {
        method: 'POST',
        body: JSON.stringify({
          fromClassId,
          toClassId,
          studentIds
        }),
        onLogout
      });

      toast({ 
        title: "Berhasil", 
        description: response.message || `${studentIds.length} siswa berhasil dinaikkan dari ${classes.find(c => c.id?.toString() === fromClassId)?.nama_kelas} ke ${classes.find(c => c.id?.toString() === toClassId)?.nama_kelas}`,
        variant: "default" 
      });

      // Reset state setelah sukses
      setSelectedStudents(new Set());
      setShowPreview(false);
      
      // Refresh data siswa kelas asal
      await fetchStudents(fromClassId);
      
    } catch (error) {
      console.error('Error promoting students:', error);
      
      // Error handling yang lebih spesifik
      const errorMessage = getErrorMessage(error);
      
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fromClass = classes.find(c => c.id?.toString() === fromClassId);
  const toClass = classes.find(c => c.id?.toString() === toClassId);

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Naik Kelas Siswa</h1>
            <p className="text-sm sm:text-base text-gray-600">Kelola kenaikan kelas siswa secara massal</p>
          </div>
        </div>
        {fromClassId && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setFromClassId('');
              setToClassId('');
              setStudents([]);
              setSelectedStudents(new Set());
            }}
            className="w-fit"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      {/* Progress Indicator */}
      {fromClassId && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-2">
              <div className="flex items-center gap-2 text-blue-600">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-blue-600 text-white">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-xs sm:text-sm font-medium">Pilih Kelas</span>
              </div>
              <div className={`w-8 h-0.5 sm:w-8 sm:h-0.5 ${selectedStudents.size > 0 ? 'bg-blue-600' : 'bg-gray-200'} hidden sm:block`}></div>
              <div className={`w-0.5 h-8 sm:w-8 sm:h-0.5 ${selectedStudents.size > 0 ? 'bg-blue-600' : 'bg-gray-200'} block sm:hidden`}></div>
              <div className={`flex items-center gap-2 ${selectedStudents.size > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${selectedStudents.size > 0 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="text-xs sm:text-sm font-medium">Pilih Siswa</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Selection - SMART AUTO-DETECT */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            Pilih Kelas Asal
          </CardTitle>
          <CardDescription className="text-sm">
            Sistem akan otomatis mendeteksi kelas tujuan berdasarkan tingkat dan jurusan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="from-class" className="text-sm font-medium">Kelas Asal *</Label>
              <Select value={fromClassId} onValueChange={setFromClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kelas asal (contoh: X IPA 1)" />
                </SelectTrigger>
                <SelectContent>
                  {classes.filter(cls => (cls as Record<string, string | number | boolean>).status === 'aktif').map((cls) => (
                    <SelectItem key={cls.id} value={cls.id?.toString() || '0'}>
                      {cls.nama_kelas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {toClassId && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 rounded-lg border-2 border-primary/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                      Kelas Tujuan Terdeteksi
                    </p>
                    <p className="text-sm sm:text-lg font-bold text-foreground break-words">
                      {fromClass?.nama_kelas} → <span className="text-emerald-600 dark:text-emerald-400">{toClass?.nama_kelas}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Message */}
      {!fromClassId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Home className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">Sistem Promosi Otomatis</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-2 px-2">Pilih kelas asal, sistem akan otomatis mendeteksi kelas tujuan</p>
              <p className="text-xs sm:text-sm text-muted-foreground/70 break-words">Contoh: X IPA 1 → XI IPA 1</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Students Message */}
      {fromClassId && students.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Tidak Ada Siswa</h3>
              <p className="text-muted-foreground">Tidak ada siswa ditemukan di kelas yang dipilih</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Info */}
      {fromClassId && (
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">
              <p><strong>Status:</strong></p>
              <p>Kelas Asal: {fromClass?.nama_kelas || 'Tidak dipilih'}</p>
              <p>Kelas Tujuan: {toClass?.nama_kelas || 'Belum terdeteksi'}</p>
              <p>Siswa Tersedia: {students.length} siswa</p>
              <p>Siswa Terpilih: {selectedStudents.size} siswa</p>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  <p><strong>Debug Info:</strong></p>
                  <p>fromClassId: {fromClassId}</p>
                  <p>toClassId: {toClassId}</p>
                  <p>isLoading: {isLoading.toString()}</p>
                  <p>isProcessing: {isProcessing.toString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students List */}
      {students.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  Daftar Siswa ({students.length} siswa)
                </CardTitle>
                <CardDescription className="text-sm">
                  Pilih siswa yang akan dinaikkan kelas
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {selectedStudents.size === students.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </Button>
                {selectedStudents.size > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                    disabled={!toClassId || !fromClassId || isProcessing}
                    className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                  >
                    Preview ({selectedStudents.size} siswa)
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {students.map((student) => (
                  <div
                    key={student.id_siswa}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-3 ${
                      selectedStudents.has(student.id_siswa) ? 'bg-primary/10 border-primary/30' : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(student.id_siswa)}
                        onChange={() => handleSelectStudent(student.id_siswa)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{student.nama}</p>
                        <p className="text-sm text-muted-foreground">NIS: {student.nis}</p>
                      </div>
                    </div>
                    <div className="flex justify-end sm:justify-start">
                      <Badge variant={student.status === 'aktif' ? 'default' : 'secondary'} className="text-xs">
                        {student.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              Preview Naik Kelas
            </DialogTitle>
            <DialogDescription className="text-sm">
              Konfirmasi data siswa yang akan dinaikkan kelas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 sm:p-4 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 rounded-lg border">
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Dari Kelas</p>
                <p className="text-sm sm:text-lg font-semibold text-blue-600 dark:text-blue-400 break-words">{fromClass?.nama_kelas}</p>
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Ke Kelas</p>
                <p className="text-sm sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400 break-words">{toClass?.nama_kelas}</p>
              </div>
            </div>
            
            <div className="p-3 sm:p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Siswa yang akan dinaikkan ({selectedStudents.size} siswa):
                </p>
              </div>
              <div className="max-h-48 sm:max-h-60 overflow-y-auto space-y-1">
                {students
                  .filter(student => selectedStudents.has(student.id_siswa))
                  .map((student) => (
                    <div key={student.id_siswa} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-card border rounded-lg hover:bg-muted/50 gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs sm:text-sm font-medium text-blue-700">
                            {student.nama.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-foreground text-sm sm:text-base truncate block">{student.nama}</span>
                          <p className="text-xs sm:text-sm text-muted-foreground">NIS: {student.nis}</p>
                        </div>
                      </div>
                      <div className="flex justify-end sm:justify-start">
                        <Badge variant="outline" className="text-xs">
                          {student.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button 
              onClick={handlePromotion}
              disabled={isProcessing || !toClassId || !fromClassId || selectedStudents.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Memproses...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Konfirmasi Naik Kelas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Button */}
      {selectedStudents.size > 0 && toClassId && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Siap untuk Naik Kelas</h3>
                <p className="text-sm text-gray-500 break-words">
                  {selectedStudents.size} siswa siap dinaikkan dari {fromClass?.nama_kelas} ke {toClass?.nama_kelas}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  className="w-full sm:w-auto"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button
                  onClick={handlePromotion}
                  disabled={isProcessing || !toClassId || !fromClassId || selectedStudents.size === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                      Naik Kelas Sekarang
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
