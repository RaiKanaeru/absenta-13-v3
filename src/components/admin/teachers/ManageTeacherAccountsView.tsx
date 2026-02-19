import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { getErrorMessage } from "@/lib/utils";
import { Download, Plus, Eye, EyeOff, Search, Users, GraduationCap, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import ExcelImportView from "../../ExcelImportView";
import { Teacher, Subject } from "@/types/dashboard";
import { GenderType, AccountStatusType } from "../types/adminTypes";

// Define clear types for backend response
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

// Helper function to format gender display
const getGenderDisplay = (jenis_kelamin: string | undefined | null): string => {
  if (jenis_kelamin === 'L') return 'Laki-laki';
  if (jenis_kelamin === 'P') return 'Perempuan';
  return '-';
};

// ManageTeacherAccountsView Component
const ManageTeacherAccountsView = ({ onLogout }: { onLogout: () => void }) => {
  const [formData, setFormData] = useState({
    nama: '', 
    username: '', 
    password: '', 
    nip: '', 
    mapel_id: '', 
    email: '', 
    no_telp: '', 
    jenis_kelamin: '' as GenderType, 
    alamat: '', 
    status: 'aktif' as AccountStatusType
  });
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Ref for AbortController to handle race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search term (500ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset page when search term or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

  const fetchTeachers = useCallback(async () => {
    // Abort previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    try {
      // Build query parameters for server-side pagination
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm || '' // Ensure string
      });

      const response = await apiCall<Teacher[] | PaginatedResponse<Teacher>>(`/api/admin/guru?${queryParams.toString()}`, { 
        onLogout,
        signal: controller.signal
      });
      
      // Handle response structure
      if (Array.isArray(response)) {
        // Fallback for array response
        setTeachers(response);
        setTotalItems(response.length);
      } else {
        // Standard paginated response
        setTeachers(response.data || []);
        setTotalItems(response.pagination?.total || 0);
      }
    } catch (error: unknown) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      const message = getErrorMessage(error);
       toast({ title: "Error memuat data guru", description: message, variant: "destructive" });
    } finally {
      // Only unset loading if this is the current request
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [currentPage, pageSize, debouncedSearchTerm, onLogout]);

  const fetchSubjects = useCallback(async () => {
    try {
      const response = await apiCall<Subject[] | { data?: Subject[] }>('/api/admin/subjects', { onLogout });
      const subjectData = Array.isArray(response) ? response : response.data || [];
      setSubjects(subjectData);
    } catch (error: unknown) {
      // Don't show error toast for subjects as it's not critical
      console.error('ManageTeacherAccountsView: Failed to load subjects', error);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);
  
  useEffect(() => {
    // Fetch subjects only once on mount
    fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extracted validation helper to reduce CC
  const validateTeacherFormData = (data: typeof formData, isEditing: boolean): string | null => {
    if (!data.nama || !data.username || !data.nip) {
      return "Nama, username, dan NIP wajib diisi!";
    }
    if (!isEditing && !data.password) {
      return "Password wajib diisi untuk akun baru!";
    }
    if (!/^\d{10,20}$/.test(data.nip)) {
      return "NIP harus berupa angka 10-20 digit!";
    }
    if (!/^[a-zA-Z0-9._-]{4,32}$/.test(data.username)) {
      return "Username harus 4-32 karakter, hanya huruf, angka, titik, underscore, dan strip!";
    }
    if (data.email && data.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return "Format email tidak valid!";
    }
    if (data.no_telp && data.no_telp.trim() !== '' && !/^[\d+]{1,20}$/.test(data.no_telp.trim())) {
      return "Nomor telepon harus berupa angka dan plus, maksimal 20 karakter!";
    }
    if (data.mapel_id && data.mapel_id !== '' && (!Number.isInteger(Number(data.mapel_id)) || Number(data.mapel_id) <= 0)) {
      return "ID mata pelajaran harus berupa angka positif!";
    }
    return null;
  };

  // Helper to build submit data for teacher form
  const buildTeacherSubmitData = (data: typeof formData) => {
    const trimOrNull = (val: string | undefined | null) => val && val.trim() !== '' ? val.trim() : null;
    return {
      nip: data.nip.trim(),
      nama: data.nama.trim(),
      username: data.username.trim(),
      password: data.password || undefined,
      email: trimOrNull(data.email),
      no_telp: trimOrNull(data.no_telp),
      jenis_kelamin: data.jenis_kelamin || null,
      alamat: trimOrNull(data.alamat),
      mapel_id: data.mapel_id && data.mapel_id !== '' ? Number.parseInt(data.mapel_id) : null,
      status: data.status
    };
  };

  // Helper: Handle submit errors with detailed extraction
   const handleSubmitError = (error: unknown) => {
     const errorDetails = typeof error === 'object' && error !== null && 'details' in error
      ? (error as { details?: unknown }).details
      : undefined;
    if (errorDetails) {
      const errorMessage = Array.isArray(errorDetails) ? errorDetails.join(', ') : String(errorDetails);
      toast({ 
        title: "Error Validasi", 
        description: errorMessage, 
        variant: "destructive" 
      });
     } else {
       const message = getErrorMessage(error);
       toast({ 
         title: "Error", 
         description: message || "Gagal menyimpan data guru", 
         variant: "destructive" 
       });
     }
  };

  const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     // Validate using extracted helper
     const validationError = validateTeacherFormData(formData, !!editingId);
     if (validationError) {
       toast({ title: "Error", description: validationError, variant: "destructive" });
       return;
     }

     setIsLoading(true);

     try {
       const url = editingId ? `/api/admin/guru/${editingId}` : '/api/admin/guru';
       const method = editingId ? 'PUT' : 'POST';
       
       // Build submit data using helper
       const submitData = buildTeacherSubmitData(formData);

       await apiCall(url, {
         method,
         body: JSON.stringify(submitData),
         onLogout
       });

        toast({ title: editingId ? "Akun guru berhasil diupdate!" : "Akun guru berhasil ditambahkan!" });
        setFormData({ 
          nama: '', 
          username: '', 
          password: '', 
          nip: '', 
          mapel_id: '', 
          email: '', 
          no_telp: '', 
          jenis_kelamin: '' as GenderType, 
          alamat: '', 
          status: 'aktif' as AccountStatusType
        });
       setEditingId(null);
       setDialogOpen(false);
       fetchTeachers();
     } catch (error: unknown) {
       handleSubmitError(error);
     }

     setIsLoading(false);
   };

  const handleEdit = (teacher: Teacher) => {
    setFormData({
      nama: teacher.nama || '',
      username: teacher.username || teacher.user_username || '',
      password: '',
      nip: teacher.nip || '',
      mapel_id: teacher.mapel_id ? String(teacher.mapel_id) : '',
      email: teacher.email || teacher.user_email || '',
      no_telp: teacher.no_telp || '',
      jenis_kelamin: (teacher.jenis_kelamin || '') as 'L' | 'P' | '',
      alamat: teacher.alamat || teacher.address || teacher.user_alamat || teacher.user_address || '',
      status: (teacher.status || 'aktif') as 'aktif' | 'nonaktif'
    });
    setEditingId(teacher.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number, nama: string) => {
    // Confirmation dialog
    if (!globalThis.confirm(`Yakin ingin menghapus akun guru "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    
    try {
      await apiCall(`/api/admin/guru/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Akun guru ${nama} berhasil dihapus` });
      fetchTeachers();
    } catch (error: unknown) {
       const message = getErrorMessage(error);
       toast({ title: "Error menghapus akun guru", description: message, variant: "destructive" });
    }
  };

  // Server-side pagination - calculate pages from server total
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedTeachers = teachers; // No client-side slicing

  if (showImport) {
    return <ExcelImportView entityType="teacher-account" entityName="Akun Guru" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              Kelola Akun Guru
            </h1>
            <p className="text-sm text-muted-foreground">Tambah, edit, dan hapus akun login guru</p>
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
                   nama: '', username: '', password: '', nip: '', mapel_id: '', email: '', no_telp: '', jenis_kelamin: '' as GenderType, alamat: '', status: 'aktif' as AccountStatusType
                 });
               }}
              size="sm"
              className="w-full sm:w-auto text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Tambah Akun Guru</span>
              <span className="sm:hidden">Tambah Guru</span>
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
              <DialogTitle className="text-base">{editingId ? 'Edit Akun Guru' : 'Tambah Akun Guru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Field 1: NIP - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="nip" className="text-sm font-medium">NIP *</Label>
                  <Input
                    id="nip"
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    placeholder="Masukkan NIP"
                    className="mt-1"
                    required
                  />
                </div>
                {/* Field 2: Nama Lengkap - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="nama" className="text-sm font-medium">Nama Lengkap *</Label>
                  <Input
                    id="nama"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Masukkan nama lengkap"
                    className="mt-1"
                    required
                  />
                </div>
                {/* Field 3: Username - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Masukkan username"
                    required
                  />
                </div>
                {/* Field 4: Email - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Masukkan email"
                  />
                </div>
                {/* Field 5: No. Telepon - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="no_telp">No. Telepon</Label>
                  <Input
                    id="no_telp"
                    value={formData.no_telp}
                    onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })}
                    placeholder="Masukkan nomor telepon"
                  />
                </div>
                {/* Field 6: Jenis Kelamin - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="jenis_kelamin">Jenis Kelamin</Label>
                  <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value as 'L' | 'P' | '' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Field 7: Alamat - sesuai urutan tabel */}
                <div className="sm:col-span-2">
                  <Label htmlFor="alamat">Alamat</Label>
                  <Input
                    id="alamat"
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    placeholder="Masukkan alamat lengkap"
                  />
                </div>
                {/* Field 8: Mata Pelajaran - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="mapel_id">Mata Pelajaran</Label>
                  <Select value={formData.mapel_id} onValueChange={(value) => setFormData({ ...formData, mapel_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih mata pelajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        // FIXED: Enhanced deduplication to prevent looping
                        const uniqueSubjects = subjects.filter((subject, index, self) => {
                          // Use multiple fields to ensure uniqueness
                          const key = `${subject.id}-${subject.nama_mapel}-${subject.kode_mapel}`;
                          return self.findIndex(s => 
                            `${s.id}-${s.nama_mapel}-${s.kode_mapel}` === key
                          ) === index;
                        });
                        
                        return uniqueSubjects.map((subject) => (
                           <SelectItem key={`subject-${subject.id}-${subject.nama_mapel}`} value={String(subject.id)}>
                             {subject.nama_mapel}
                           </SelectItem>
                         ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                {/* Field 9: Status - sesuai urutan tabel */}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as 'aktif' | 'nonaktif' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="nonaktif">Non-aktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Field Password - untuk keamanan, tidak ditampilkan di tabel tapi tetap diperlukan */}
                <div className="sm:col-span-2">
                  <Label htmlFor="password">
                    Password {editingId ? '(Kosongkan jika tidak ingin mengubah)' : '*'}
                  </Label>
                  <div className="relative">
                  <Input
                    id="password"
                      type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Masukkan password"
                    required={!editingId}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isLoading}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  {isLoading ? 'Menyimpan...' : editingId ? 'Update' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Cari berdasarkan nama, username, atau NIP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary" className="px-3 py-1 self-start sm:self-center">
                {totalItems} guru ditemukan
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
            <Users className="w-4 h-4" />
            Daftar Akun Guru
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Belum Ada Data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm ? 'Tidak ada guru yang sesuai dengan pencarian' : 'Belum ada akun guru yang ditambahkan'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setDialogOpen(true)} size="sm" className="w-full sm:w-auto text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Tambah Akun Guru Pertama</span>
                  <span className="sm:hidden">Tambah Guru Pertama</span>
                </Button>
              )}
            </div>
          ) : (
            <>
            {/* Desktop Table View - hidden on mobile and tablet */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-xs">#</TableHead>
                    <TableHead className="text-xs">NIP</TableHead>
                    <TableHead className="text-xs">Nama Lengkap</TableHead>
                    <TableHead className="text-xs">Username</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">No. Telepon</TableHead>
                    <TableHead className="text-xs">Jenis Kelamin</TableHead>
                    <TableHead className="text-xs">Alamat</TableHead>
                    <TableHead className="text-xs">Mata Pelajaran</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-center text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedTeachers.map((teacher, index) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="text-muted-foreground text-xs sm:text-sm">{startIndex + index + 1}</TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">{teacher.nip || '-'}</TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">{teacher.nama || '-'}</TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">{teacher.username || teacher.user_username || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{teacher.email || teacher.user_email || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{teacher.no_telp || '-'}</TableCell>
                       <TableCell className="text-xs sm:text-sm">{getGenderDisplay(teacher.jenis_kelamin)}</TableCell>
                      <TableCell className="text-xs sm:text-sm max-w-24 sm:max-w-32 truncate" title={teacher.alamat || teacher.address || teacher.user_alamat || teacher.user_address || 'Tidak ada alamat'}>
                        {teacher.alamat || teacher.address || teacher.user_alamat || teacher.user_address || '-'}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{teacher.nama_mapel || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={teacher.status === 'aktif' ? 'default' : 'destructive'}
                          className={`text-xs px-1 py-0.5 ${teacher.status === 'aktif' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25' : 'bg-destructive/15 text-destructive hover:bg-destructive/25'}`}
                        >
                          {teacher.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(teacher)}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                          >
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline ml-1">Edit</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline ml-1">Hapus</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Akun Guru</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus akun guru <strong>{teacher.nama}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(teacher.id, teacher.nama)}
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

            {/* Mobile & Tablet Card View */}
              <div className="lg:hidden space-y-3">
                {pagedTeachers.map((teacher) => (
                <Card key={teacher.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{teacher.nama || '-'}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{teacher.nip || '-'}</p>
                        <p className="text-xs text-muted-foreground">@{teacher.username || teacher.user_username || '-'}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(teacher)}
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
                              <AlertDialogTitle>Hapus Akun Guru</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus akun guru <strong>{teacher.nama}</strong>?
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(teacher.id, teacher.nama)}
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
                        <span className="text-muted-foreground">Email:</span>
                        <p className="truncate">{teacher.email || teacher.user_email || '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Telepon:</span>
                        <p>{teacher.no_telp || '-'}</p>
                      </div>
                       <div>
                         <span className="text-muted-foreground">Jenis Kelamin:</span>
                         <p>{getGenderDisplay(teacher.jenis_kelamin)}</p>
                       </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <Badge 
                          variant={teacher.status === 'aktif' ? 'default' : 'destructive'}
                          className={`text-xs ${teacher.status === 'aktif' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/15 text-destructive'}`}
                        >
                          {teacher.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </div>
                    </div>
                    
                    {teacher.nama_mapel && (
                      <div>
                        <span className="text-muted-foreground text-xs">Mata Pelajaran:</span>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs ml-1">
                          {teacher.nama_mapel}
                        </Badge>
                      </div>
                    )}
                    
                    {teacher.alamat && (
                      <div>
                        <span className="text-muted-foreground text-xs">Alamat:</span>
                        <p className="text-xs mt-1">{teacher.alamat}</p>
                      </div>
                    )}
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

export default ManageTeacherAccountsView;
