import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { 
  RefreshCw, CheckCircle, Users, ArrowUpCircle, 
  ArrowRight, Home, Eye, Loader2, GraduationCap
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

// =============================================================================
// HELPER FUNCTIONS FOR CLASSNAME CONSTRUCTION (SonarQube Issue: Nested Ternaries)
// =============================================================================

/** Get progress indicator line class based on selection state */
const getProgressLineClass = (hasSelection: boolean): string => {
  return hasSelection ? 'bg-blue-500' : 'bg-border';
};

/** Get progress indicator color class based on selection state */
const getProgressColorClass = (hasSelection: boolean): string => {
  return hasSelection ? 'text-blue-600' : 'text-muted-foreground';
};

/** Get progress indicator background class based on selection state */
const getProgressBgClass = (hasSelection: boolean): string => {
  return hasSelection ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'bg-muted text-muted-foreground';
};

/** Get student row class based on selection state */
const getStudentRowClass = (isSelected: boolean): string => {
  return isSelected
    ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
    : 'bg-card border-border hover:bg-accent/40';
};

export const StudentPromotionView = ({ onLogout }: { onLogout: () => void }) => {
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
      toast({ title: "Error memuat data kelas", description: getErrorMessage(error), variant: "destructive" });
    }
  }, [onLogout]);

  const fetchStudents = useCallback(async (classId: string) => {
    if (!classId) {
      return;
    }
    setIsLoading(true);
    try {
      // Backend returns { data: [...], pagination: {...} } format
      const response = await apiCall<{ data: StudentData[], pagination: unknown } | StudentData[]>('/api/admin/students-data', { onLogout });

      // Handle both response formats for compatibility
      let studentsArray: StudentData[] = [];
      if (response && typeof response === 'object' && 'data' in response) {
        // New format: { data: [...], pagination: {...} }
        studentsArray = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        // Legacy format: direct array
        studentsArray = response;
      } else {
        setStudents([]);
        toast({ 
          title: "Error Format Data", 
          description: "Data siswa tidak dalam format yang benar", 
          variant: "destructive" 
        });
        return;
      }
      
      const filteredStudents = studentsArray.filter((student: StudentData) => {
        // Convert both to string for comparison
        const studentClassId = student.kelas_id?.toString();
        const targetClassId = classId.toString();
        const matches = studentClassId === targetClassId;
        return matches;
      });
      setStudents(filteredStudents);
      setSelectedStudents(new Set()); // Reset selection
    } catch (error) {
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
      const isMatch = targetParsed?.level === targetLevel &&
             targetParsed?.major === parsed.major &&
             targetParsed?.number === parsed.number;
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

  // Stepper state helpers
  const step1Done = !!fromClassId && !!toClassId;
  const step2Done = selectedStudents.size > 0;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Naik Kelas Siswa</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-0.5">
            Kelola kenaikan kelas siswa secara massal dengan deteksi otomatis
          </p>
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
            className="w-fit gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Modern Stepper */}
      {fromClassId && (
        <Card className="border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex">
              {/* Step 1 */}
              <div className={`flex-1 flex flex-col sm:flex-row items-center gap-3 px-4 sm:px-6 py-4 transition-colors ${step1Done ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-blue-50 dark:bg-blue-950/20'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${step1Done ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900' : 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900'}`}>
                  {step1Done
                    ? <CheckCircle className="w-4 h-4" />
                    : <span className="text-xs font-bold">1</span>
                  }
                </div>
                <div className="text-center sm:text-left">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${step1Done ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    Langkah 1
                  </p>
                  <p className="text-sm font-medium text-foreground">Pilih Kelas</p>
                </div>
              </div>

              {/* Connector */}
              <div className="flex items-center px-1 sm:px-0">
                <div className={`w-8 h-0.5 sm:w-10 hidden sm:block transition-colors ${step1Done ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border'}`} />
                <ArrowRight className={`w-4 h-4 block sm:hidden mx-1 transition-colors ${step1Done ? 'text-emerald-400' : 'text-border'}`} />
              </div>

              {/* Step 2 */}
              <div className={`flex-1 flex flex-col sm:flex-row items-center gap-3 px-4 sm:px-6 py-4 transition-colors ${step2Done ? 'bg-emerald-50 dark:bg-emerald-950/20' : step1Done ? 'bg-card' : 'bg-muted/30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${step2Done ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900' : step1Done ? getProgressBgClass(false) + ' border border-border' : 'bg-muted text-muted-foreground'}`}>
                  {step2Done
                    ? <CheckCircle className="w-4 h-4" />
                    : <Users className="w-4 h-4" />
                  }
                </div>
                <div className="text-center sm:text-left">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${step2Done ? 'text-emerald-600 dark:text-emerald-400' : getProgressColorClass(step1Done)}`}>
                    Langkah 2
                  </p>
                  <p className={`text-sm font-medium ${step1Done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Pilih Siswa
                  </p>
                </div>
              </div>

              {/* Connector */}
              <div className="flex items-center px-1 sm:px-0">
                <div className={`w-8 h-0.5 sm:w-10 hidden sm:block transition-colors ${step2Done ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border'}`} />
                <ArrowRight className={`w-4 h-4 block sm:hidden mx-1 transition-colors ${step2Done ? 'text-emerald-400' : 'text-border'}`} />
              </div>

              {/* Step 3 */}
              <div className={`flex-1 flex flex-col sm:flex-row items-center gap-3 px-4 sm:px-6 py-4 transition-colors ${step2Done ? 'bg-card' : 'bg-muted/30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${step2Done ? 'bg-muted border border-border text-muted-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <ArrowUpCircle className="w-4 h-4" />
                </div>
                <div className="text-center sm:text-left">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${getProgressColorClass(step2Done)}`}>
                    Langkah 3
                  </p>
                  <p className={`text-sm font-medium ${step2Done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Konfirmasi
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Selection - SMART AUTO-DETECT */}
      <Card className="border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/40">
              <ArrowUpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            Pilih Kelas Asal
          </CardTitle>
          <CardDescription className="text-sm">
            Sistem akan otomatis mendeteksi kelas tujuan berdasarkan tingkat dan jurusan
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="from-class" className="text-sm font-medium">
                Kelas Asal <span className="text-red-500">*</span>
              </Label>
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-950/30 dark:to-emerald-950/30 dark:border-emerald-800">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* From class chip */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Kelas Asal</p>
                    <p className="text-sm sm:text-base font-semibold text-blue-700 dark:text-blue-300 truncate">
                      {fromClass?.nama_kelas}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-muted border flex items-center justify-center flex-shrink-0 shadow-sm">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>

                  {/* To class chip */}
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Kelas Tujuan</p>
                    <p className="text-sm sm:text-base font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                      {toClass?.nama_kelas}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Message - empty state */}
      {!fromClassId && (
        <Card className="border border-dashed shadow-none">
          <CardContent className="pt-6">
            <div className="text-center py-10 px-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Home className="w-7 h-7 text-muted-foreground/60" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5">
                Sistem Promosi Otomatis
              </h3>
              <p className="text-sm text-muted-foreground mb-2 max-w-xs mx-auto">
                Pilih kelas asal, sistem akan otomatis mendeteksi kelas tujuan berdasarkan pola nama kelas
              </p>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 bg-muted px-3 py-1.5 rounded-full">
                <span className="font-medium text-blue-600">X IPA 1</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-medium text-emerald-600">XI IPA 1</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Students Message */}
      {fromClassId && students.length === 0 && !isLoading && (
        <Card className="border shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center py-10 px-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-muted-foreground/60" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5">
                Tidak Ada Siswa
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Tidak ada siswa ditemukan di kelas yang dipilih
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Info Panel */}
      {fromClassId && (
        <Card className="border shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Kelas Asal</p>
                <p className="text-sm font-semibold text-foreground truncate">{fromClass?.nama_kelas || '—'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Kelas Tujuan</p>
                <p className="text-sm font-semibold text-foreground truncate">{toClass?.nama_kelas || '—'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Siswa Tersedia</p>
                <p className="text-sm font-semibold text-foreground">{students.length}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Terpilih</p>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{selectedStudents.size}</p>
              </div>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-3 p-2.5 bg-muted rounded-lg text-xs space-y-1 border border-dashed">
                <p className="font-semibold text-muted-foreground">Debug Info</p>
                <p className="text-muted-foreground">fromClassId: {fromClassId}</p>
                <p className="text-muted-foreground">toClassId: {toClassId}</p>
                <p className="text-muted-foreground">isLoading: {isLoading.toString()}</p>
                <p className="text-muted-foreground">isProcessing: {isProcessing.toString()}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Students List */}
      {students.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-4 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
                  <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-900/40">
                    <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  Daftar Siswa
                  <Badge variant="secondary" className="ml-1 font-medium">
                    {students.length}
                  </Badge>
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
                  className="w-full sm:w-auto text-xs gap-1.5 transition-colors"
                >
                  {selectedStudents.size === students.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </Button>
                {selectedStudents.size > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                    disabled={!toClassId || !fromClassId || isProcessing}
                    className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 w-full sm:w-auto text-xs gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview ({selectedStudents.size} siswa)
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {students.map((student) => (
                  <div
                    key={student.id_siswa}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-xl gap-3 cursor-pointer transition-colors ${getStudentRowClass(selectedStudents.has(student.id_siswa))}`}
                    onClick={() => handleSelectStudent(student.id_siswa)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(student.id_siswa)}
                        onChange={() => handleSelectStudent(student.id_siswa)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0 cursor-pointer"
                      />
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold transition-colors ${
                        selectedStudents.has(student.id_siswa)
                          ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {student.nama.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm truncate">{student.nama}</p>
                        <p className="text-xs text-muted-foreground">NIS: {student.nis}</p>
                      </div>
                    </div>
                    <div className="flex justify-end sm:justify-start">
                      <Badge
                        variant={student.status === 'aktif' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
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
            <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg">
              <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40">
                <ArrowUpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Preview Naik Kelas
            </DialogTitle>
            <DialogDescription className="text-sm">
              Periksa dan konfirmasi data siswa yang akan dinaikkan kelas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Class route display */}
            <div className="grid grid-cols-5 gap-2 items-center p-4 rounded-xl border bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-950/30 dark:to-emerald-950/30 dark:border-blue-800/50">
              <div className="col-span-2 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Dari Kelas</p>
                <p className="text-sm sm:text-base font-bold text-blue-700 dark:text-blue-300 break-words">{fromClass?.nama_kelas}</p>
              </div>
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-muted border flex items-center justify-center shadow-sm">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
              <div className="col-span-2 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Ke Kelas</p>
                <p className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300 break-words">{toClass?.nama_kelas}</p>
              </div>
            </div>

            {/* Student list in dialog */}
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Siswa yang akan dinaikkan
                </p>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {selectedStudents.size} siswa
                </Badge>
              </div>
              <div className="max-h-52 sm:max-h-64 overflow-y-auto divide-y">
                {students
                  .filter(student => selectedStudents.has(student.id_siswa))
                  .map((student) => (
                    <div key={student.id_siswa} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {student.nama.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-foreground text-sm truncate block">{student.nama}</span>
                          <p className="text-xs text-muted-foreground">NIS: {student.nis}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {student.status}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
              className="w-full sm:w-auto transition-colors"
            >
              Batal
            </Button>
            <Button 
              onClick={handlePromotion}
              disabled={isProcessing || !toClassId || !fromClassId || selectedStudents.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 w-full sm:w-auto transition-colors gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4" />
                  Konfirmasi Naik Kelas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Bottom Card */}
      {selectedStudents.size > 0 && toClassId && (
        <Card className="border shadow-md bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 border-emerald-200 dark:border-emerald-800/50">
          <CardContent className="pt-4 sm:pt-5 pb-4 sm:pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground">
                    Siap untuk Naik Kelas
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    <span className="font-medium text-blue-600 dark:text-blue-400">{selectedStudents.size} siswa</span>
                    {' '}dari{' '}
                    <span className="font-medium">{fromClass?.nama_kelas}</span>
                    {' → '}
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{toClass?.nama_kelas}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(true)}
                  className="w-full sm:w-auto gap-2 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  onClick={handlePromotion}
                  disabled={isProcessing || !toClassId || !fromClassId || selectedStudents.size === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 w-full sm:w-auto gap-2 transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-3.5 h-3.5" />
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
