import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Download, Plus, Eye, EyeOff, Edit, Trash2, Home, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { apiCall } from '@/utils/apiClient';
import { getErrorMessage } from '@/lib/utils';
import ExcelImportView from '../../ExcelImportView';
import { Student, Kelas } from '@/types/dashboard';

interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

interface ManageStudentsViewProps {
  onLogout: () => void;
}

export const ManageStudentsView = ({ onLogout }: ManageStudentsViewProps) => {
  const [formData, setFormData] = useState({ 
    nama: '', 
    nis: '', 
    kelas_id: '', 
    jenis_kelamin: '', 
    telepon_orangtua: '', 
    nomor_telepon_siswa: '', 
    alamat: '', 
    status: 'aktif',
    username: '',
    password: '',
    email: '',
    jabatan: 'Siswa',
    is_perwakilan: true
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNis, setEditingNis] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

   // Reset to page 1 when search term changes
   useEffect(() => {
     setCurrentPage(1);
   }, [debouncedSearchTerm]);

  const fetchStudents = useCallback(async () => {
    // Abort previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm || ''
      });

      const response = await apiCall<Student[] | PaginatedResponse<Student>>(
        `/api/admin/students?${queryParams.toString()}`,
        { onLogout, signal: controller.signal }
      );

      // Handle both array and paginated response formats
      if (Array.isArray(response)) {
        setStudents(response);
        setTotalItems(response.length);
      } else {
        setStudents(response.data || []);
        setTotalItems(response.pagination?.total || 0);
      }
     } catch (error: unknown) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      const message = getErrorMessage(error);
      toast({ title: "Error memuat data siswa", description: message, variant: "destructive" });
    } finally {
      // Only unset loading if this is the current request
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [currentPage, pageSize, debouncedSearchTerm, onLogout]);


  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall<Kelas[]>('/api/admin/classes', { onLogout });
      setClasses(data);
    } catch (error: unknown) {
      // Don't show error toast for classes as it's not critical
      console.error('ManageStudentsView: Failed to load classes', error);
    }
  }, [onLogout]);

  // Validasi form using declarative rules
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    // Define validation rules
    type ValidationRule = { field: string; condition: boolean; message: string };
    const rules: ValidationRule[] = [
      { field: 'nis', condition: !editingId && (!formData.nis || !/^\d{8,15}$/.test(formData.nis)), message: 'NIS harus berupa angka 8-15 digit' },
      { field: 'username', condition: !formData.username || !/^[a-z0-9._-]{4,30}$/.test(formData.username), message: 'Username harus 4-30 karakter, hanya huruf kecil, angka, titik, underscore, dan strip' },
      { field: 'password', condition: !editingId && (!formData.password || formData.password.length < 6), message: 'Password wajib diisi minimal 6 karakter' },
      { field: 'email', condition: !!formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email), message: 'Format email tidak valid' }
    ];
    
    // Apply validation rules
    rules.forEach(rule => {
      if (rule.condition) errors[rule.field] = rule.message;
    });

    if (!editingId && !formData.is_perwakilan) {
      errors.is_perwakilan = 'Akun siswa harus ditandai sebagai perwakilan';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

   // Helper: Build submit data based on edit mode
   const buildSubmitData = () => {
     const baseData = {
       username: formData.username,
       password: formData.password,
       email: formData.email,
       status: formData.status,
       is_perwakilan: Boolean(formData.is_perwakilan)
     };
     return editingId ? baseData : { ...baseData, nis: formData.nis };
   };

    // Helper: Handle submit errors with detailed extraction
    const handleSubmitError = (error: unknown) => {
      const errorDetails = typeof error === 'object' && error !== null && 'details' in error
        ? (error as { details?: unknown }).details
        : undefined;
      
      if (errorDetails) {
        const errorMessage = Array.isArray(errorDetails) ? errorDetails.join(', ') : String(errorDetails);
        toast({ title: "Error Validasi", description: errorMessage, variant: "destructive" });
      } else {
        const message = getErrorMessage(error);
        toast({ title: "Error", description: message, variant: "destructive" });
      }
    };

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!validateForm()) {
       toast({ title: "Error", description: "Mohon perbaiki error pada form", variant: "destructive" });
       return;
     }

     setIsLoading(true);

     try {
       const url = editingId ? `/api/admin/students/${editingNis}` : '/api/admin/students';
       const method = editingId ? 'PUT' : 'POST';
       const submitData = buildSubmitData();

       await apiCall(url, {
         method,
         body: JSON.stringify(submitData),
         onLogout
       });

       toast({ title: editingId ? "Data siswa berhasil diupdate!" : "Data siswa berhasil ditambahkan!" });
       setFormData({ 
         nama: '', 
         nis: '', 
         kelas_id: '', 
         jenis_kelamin: '', 
         telepon_orangtua: '', 
         nomor_telepon_siswa: '', 
         alamat: '', 
         status: 'aktif',
         username: '',
         password: '',
         email: '',
         jabatan: 'Siswa',
         is_perwakilan: true
       });
       setFormErrors({});
       setEditingId(null);
       setEditingNis(null);
       setDialogOpen(false);
       fetchStudents();
     } catch (error: unknown) {
       handleSubmitError(error);
     }

     setIsLoading(false);
   };

   const handleEdit = (student: Student) => {
     const rawIsPerwakilan = (student as unknown as Record<string, unknown>).is_perwakilan;
     const isPerwakilan = typeof rawIsPerwakilan === 'boolean' ? rawIsPerwakilan : Boolean(rawIsPerwakilan);
     setFormData({ 
       nama: student.nama, 
       nis: student.nis || '',
       kelas_id: String(student.kelas_id || ''),
       jenis_kelamin: student.jenis_kelamin || '',
       telepon_orangtua: student.telepon_orangtua || '',
       nomor_telepon_siswa: student.nomor_telepon_siswa || '',
       alamat: student.alamat || '',
       status: student.status || 'aktif',
       username: student.username || '',
       password: '', // Kosongkan password saat edit
       email: student.email || '',
       jabatan: student.jabatan || 'Siswa',
       is_perwakilan: isPerwakilan
     });
     setEditingId(student.id);
     setEditingNis(student.nis || null);
     setFormErrors({});
     setDialogOpen(true);
   };

   const handleDelete = async (id: number, nama: string, nis: string) => {
     if (!globalThis.confirm(`Yakin ingin menghapus akun siswa "${nama}" (NIS: ${nis})? Tindakan ini tidak dapat dibatalkan.`)) {
       return;
     }
     try {
       await apiCall(`/api/admin/students/${nis}`, {
         method: 'DELETE',
         onLogout
       });

       toast({ title: `Data siswa ${nama} (NIS: ${nis}) berhasil dihapus` });
       fetchStudents();
     } catch (error: unknown) {
       const message = getErrorMessage(error);
       toast({ title: "Error menghapus data siswa", description: message, variant: "destructive" });
     }
   };

  // Server-side pagination - no client-side filtering
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pagedStudents = students; // Server already returns paginated data

  if (showImport) {
    return <ExcelImportView entityType="siswa" entityName="Data Siswa" onBack={() => setShowImport(false)} />;
  }

  const submitButtonLabel = editingId ? 'Simpan Perubahan' : 'Tambah Siswa';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">
              Kelola Akun Siswa
            </h1>
            <p className="text-sm text-gray-600">Tambah, edit, dan hapus akun login siswa perwakilan</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="w-full sm:w-auto text-xs">
            <Download className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Import</span>
          </Button>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingId(null);
                setFormData({ 
                  nama: '', 
                  nis: '', 
                  kelas_id: '', 
                  jenis_kelamin: '', 
                  telepon_orangtua: '', 
                  nomor_telepon_siswa: '', 
                  alamat: '', 
    status: 'aktif',
    username: '',
    password: '',
    email: '',
    jabatan: 'Siswa',
    is_perwakilan: true
  });
                setFormErrors({});
              }} 
              size="sm"
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Tambah Akun Siswa</span>
              <span className="sm:hidden">Tambah Siswa</span>
            </Button>
          </DialogTrigger>
          <DialogContent 
            className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 50,
              width: '95vw',
              maxWidth: '42rem',
              margin: '0',
              padding: '1rem',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              boxSizing: 'border-box'
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-base">{editingId ? 'Edit Akun Siswa' : 'Tambah Akun Siswa'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nama">Nama Lengkap</Label>
                  <Input
                    id="nama"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Diambil dari Data Siswa"
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Masukkan username"
                    className={formErrors.username ? 'border-red-500' : ''}
                  />
                  {formErrors.username && <p className="text-sm text-red-500 mt-1">{formErrors.username}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="password">
                    Password {editingId ? '(Kosongkan jika tidak ingin mengubah)' : '*'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingId ? "Kosongkan jika tidak ingin mengubah" : "Masukkan password"}
                      className={`pr-10 ${formErrors.password ? 'border-red-500' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-sm text-red-500 mt-1">{formErrors.password}</p>}
                </div>
                <div>
                    <Label htmlFor="nis">NIS *</Label>
                    <Input
                      id="nis"
                      value={formData.nis}
                      onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                      placeholder="Masukkan NIS (8-15 digit)"
                      disabled={Boolean(editingId)}
                      className={formErrors.nis ? 'border-red-500' : ''}
                    />
                    {formErrors.nis && <p className="text-sm text-red-500 mt-1">{formErrors.nis}</p>}
                    <p className="text-xs text-gray-500 mt-1">Data siswa diambil dari menu Data Siswa.</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                    <Label htmlFor="kelas_id">Kelas</Label>
                    <Select value={formData.kelas_id} onValueChange={(value) => setFormData({ ...formData, kelas_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.filter(kelas => kelas.id).map((kelas) => (
                          <SelectItem key={`class-select-${kelas.id}`} value={kelas.id.toString()}>
                            {kelas.nama_kelas} {kelas.tingkat ? `(${kelas.tingkat})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="jabatan">Jabatan</Label>
                    <Select value={formData.jabatan} onValueChange={(value) => setFormData({ ...formData, jabatan: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jabatan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Siswa">Siswa</SelectItem>
                        <SelectItem value="Ketua Kelas">Ketua Kelas</SelectItem>
                        <SelectItem value="Wakil Ketua">Wakil Ketua</SelectItem>
                        <SelectItem value="Sekretaris Kelas">Sekretaris Kelas</SelectItem>
                        <SelectItem value="Bendahara">Bendahara</SelectItem>
                        <SelectItem value="Anggota">Anggota</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                <div className="flex items-center gap-2">
                  <input
                    id="is-perwakilan"
                    type="checkbox"
                    checked={formData.is_perwakilan}
                    onChange={(e) => setFormData({ ...formData, is_perwakilan: e.target.checked })}
                    className="rounded border-border text-emerald-600 focus:ring-ring"
                  />
                  <Label htmlFor="is-perwakilan" className="text-sm font-medium text-gray-700">
                    Akun perwakilan
                  </Label>
                </div>
                {formErrors.is_perwakilan && (
                  <p className="text-sm text-red-500 sm:col-span-2">{formErrors.is_perwakilan}</p>
                )}
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="jenis_kelamin">Jenis Kelamin</Label>
                  <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Diambil dari Data Siswa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Masukkan email (opsional)"
                    className={formErrors.email ? 'border-red-500' : ''}
                  />
                  {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="telepon_orangtua">Telepon Orang Tua</Label>
                  <Input
                    id="telepon_orangtua"
                    value={formData.telepon_orangtua}
                    onChange={(e) => setFormData({ ...formData, telepon_orangtua: e.target.value })}
                    placeholder="Diambil dari Data Siswa"
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="nomor_telepon_siswa">Telepon Siswa</Label>
                  <Input
                    id="nomor_telepon_siswa"
                    value={formData.nomor_telepon_siswa}
                    onChange={(e) => setFormData({ ...formData, nomor_telepon_siswa: e.target.value })}
                    placeholder="Diambil dari Data Siswa"
                    disabled
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="alamat">Alamat</Label>
                <Input
                  id="alamat"
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  placeholder="Diambil dari Data Siswa"
                  disabled
                />
              </div>

              <DialogFooter className="mt-4">
                <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Menyimpan...
                    </>
                  ) : (
                    submitButtonLabel
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama, NIS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {totalItems} siswa ditemukan
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Limit</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[72px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">Hal {currentPage} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="w-4 h-4" />
            Daftar Akun Siswa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-8">
              <Home className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {debouncedSearchTerm ? 'Tidak ada siswa yang cocok dengan pencarian' : 'Belum ada akun siswa yang ditambahkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">NIS</TableHead>
                      <TableHead className="text-xs">Nama</TableHead>
                      <TableHead className="text-xs">Kelas</TableHead>
                      <TableHead className="text-xs">Jabatan</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-center text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="text-xs">{student.nis}</TableCell>
                        <TableCell className="font-medium text-xs">{student.nama}</TableCell>
                        <TableCell className="text-xs">{student.nama_kelas}</TableCell>
                        <TableCell className="text-xs">{student.jabatan || 'Siswa'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={student.status === 'aktif' ? 'default' : 'secondary'}
                            className={`text-xs ${student.status === 'aktif' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                          >
                            {student.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(student)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Siswa</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus siswa <strong>{student.nama}</strong>?
                                    Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(student.id, student.nama, student.nis)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {pagedStudents.map((student) => (
                  <Card key={student.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{student.nama}</h3>
                          <p className="text-xs text-gray-500">{student.nis}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(student)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 h-7 w-7 p-0">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Siswa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus siswa <strong>{student.nama}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(student.id, student.nama, student.nis)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground block">Kelas:</span>
                          <span className="font-medium">{student.nama_kelas}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Jabatan:</span>
                          <span className="font-medium">{student.jabatan || 'Siswa'}</span>
                        </div>
                      </div>
                      
                      <div>
                        <Badge 
                          variant={student.status === 'aktif' ? 'default' : 'secondary'}
                          className={`text-xs ${student.status === 'aktif' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                        >
                          {student.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
