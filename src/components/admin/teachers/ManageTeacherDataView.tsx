import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { ArrowLeft, Download, Search, GraduationCap, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import ExcelImportView from "../../ExcelImportView";
import { TeacherData, Subject } from "@/types/dashboard";

// ManageTeacherDataView Component  
const ManageTeacherDataView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [formData, setFormData] = useState({ 
    nip: '', 
    nama: '', 
    email: '', 
    mata_pelajaran: '',
    alamat: '',
    telepon: '',
    jenis_kelamin: '' as 'L' | 'P' | '',
    status: 'aktif' as 'aktif' | 'nonaktif'
  });
  const [teachersData, setTeachersData] = useState<TeacherData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchTeachersData = useCallback(async () => {
    try {
      const response = await apiCall<{ data: TeacherData[], pagination: any }>('/api/admin/teachers-data', { onLogout });
      // Backend mengirim format { data: [...], pagination: {...} }
      if (response && typeof response === 'object' && 'data' in response) {
        setTeachersData(Array.isArray(response.data) ? response.data : []);
      } else if (Array.isArray(response)) {
        // Fallback jika backend mengirim array langsung
        setTeachersData(response);
      } else {
        setTeachersData([]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Error memuat data guru", description: message, variant: "destructive" });
    }
  }, [onLogout]);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await apiCall<Subject[]>('/api/admin/mapel', { onLogout });
      setSubjects(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      // Don't show error toast for subjects as it's not critical
      console.error('ManageTeacherDataView: Failed to load subjects', error);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchTeachersData();
    fetchSubjects();
  }, [fetchTeachersData, fetchSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Declarative validation rules
    const validationRules = [
      { test: !formData.nip || !formData.nama, message: "NIP dan Nama wajib diisi!" },
      { test: !formData.jenis_kelamin, message: "Jenis kelamin wajib diisi!" },
      { test: formData.nip && !/^\d{10,20}$/.test(formData.nip), message: "NIP harus berupa angka 10-20 digit!" },
      { test: formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email), message: "Format email tidak valid!" },
      { test: formData.telepon?.trim() && !/^[\d+]{1,20}$/.test(formData.telepon.trim()), message: "Nomor telepon harus berupa angka, maksimal 20 karakter!" }
    ];
    
    for (const rule of validationRules) {
      if (rule.test) {
        toast({ title: "Error", description: rule.message, variant: "destructive" });
        return;
      }
    }
    // === END VALIDASI ===

    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/teachers-data/${editingId}` : '/api/admin/teachers-data';
      const method = editingId ? 'PUT' : 'POST';
      
      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout
      });

      toast({ title: editingId ? "Data guru berhasil diupdate!" : "Data guru berhasil ditambahkan!" });
      setFormData({ 
        nip: '', 
        nama: '', 
        email: '', 
        mata_pelajaran: '',
        alamat: '',
        telepon: '',
        jenis_kelamin: '' as 'L' | 'P' | '',
        status: 'aktif'
      });
      setEditingId(null);
      fetchTeachersData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Error", description: message, variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleEdit = (teacher: TeacherData) => {
    setFormData({ 
      nip: teacher.nip, 
      nama: teacher.nama, 
      email: teacher.email || '',
      mata_pelajaran: teacher.mata_pelajaran || '',
      alamat: teacher.alamat || '',
      telepon: teacher.telepon || '',
      jenis_kelamin: teacher.jenis_kelamin,
      status: teacher.status
    });
    setEditingId(teacher.id);
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!globalThis.confirm(`Yakin ingin menghapus data guru "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/teachers-data/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Data guru ${nama} berhasil dihapus` });
      fetchTeachersData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Error menghapus data guru", description: message, variant: "destructive" });
    }
  };

  const filteredTeachers = teachersData.filter(teacher => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (teacher.nama && teacher.nama.toLowerCase().includes(searchLower)) ||
      (teacher.nip && teacher.nip.toLowerCase().includes(searchLower)) ||
      (teacher.mata_pelajaran && teacher.mata_pelajaran.toLowerCase().includes(searchLower))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedTeachers = filteredTeachers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (showImport) {
    return <ExcelImportView entityType="guru" entityName="Data Guru" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button onClick={onBack} variant="outline" size="sm" className="self-start">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              Kelola Data Guru
            </h1>
            <p className="text-sm text-muted-foreground">Tambah dan kelola data lengkap guru</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Import Excel
          </Button>
        </div>
      </div>

      {/* Add Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="w-4 h-4" />
            {editingId ? 'Edit Data Guru' : 'Tambah Data Guru'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="teacher-nip" className="text-sm font-medium">NIP *</Label>
                <Input 
                  id="teacher-nip" 
                  value={formData.nip} 
                  onChange={(e) => setFormData({...formData, nip: e.target.value})} 
                  placeholder="Nomor Induk Pegawai"
                  className="mt-1"
                  required 
                />
              </div>
            </div>
              <div>
                <Label htmlFor="teacher-nama" className="text-sm font-medium">Nama Lengkap *</Label>
                <Input 
                  id="teacher-nama" 
                  value={formData.nama} 
                  onChange={(e) => setFormData({...formData, nama: e.target.value})} 
                  placeholder="Nama lengkap guru"
                  className="mt-1"
                  required 
                />
              </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="teacher-email" className="text-sm font-medium">Email</Label>
                <Input 
                  id="teacher-email" 
                  type="email"
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  placeholder="Email guru"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="teacher-telepon" className="text-sm font-medium">Telepon</Label>
                <Input 
                  id="teacher-telepon" 
                  value={formData.telepon} 
                  onChange={(e) => setFormData({...formData, telepon: e.target.value})} 
                  placeholder="Nomor telepon"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="teacher-mapel" className="text-sm font-medium">Mata Pelajaran</Label>
                <Select value={formData.mata_pelajaran} onValueChange={(value) => setFormData({...formData, mata_pelajaran: value})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih mata pelajaran" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.filter(s => s.status === 'aktif').map((subject) => (
                      <SelectItem key={subject.id} value={subject.nama_mapel}>
                        {subject.nama_mapel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="teacher-gender" className="text-sm font-medium">Jenis Kelamin *</Label>
                <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({...formData, jenis_kelamin: value as 'L' | 'P'})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih jenis kelamin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="teacher-alamat" className="text-sm font-medium">Alamat</Label>
              <Textarea 
                id="teacher-alamat" 
                value={formData.alamat} 
                onChange={(e) => setFormData({...formData, alamat: e.target.value})} 
                placeholder="Alamat lengkap"
                rows={2}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="teacher-status" className="text-sm font-medium">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as 'aktif' | 'nonaktif'})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Non-aktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-sm">
                    {isLoading ? 'Menyimpan...' : (editingId ? 'Update' : 'Tambah')}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingId(null);
                      setFormData({ 
                        nip: '', 
                        nama: '', 
                        email: '', 
                        mata_pelajaran: '',
                        alamat: '',
                        telepon: '',
                        jenis_kelamin: '' as 'L' | 'P' | '',
                        status: 'aktif'
                      });
                    }} className="text-sm">
                      Batal
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Cari berdasarkan nama, NIP, atau mata pelajaran..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
                {filteredTeachers.length} guru ditemukan
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
            <GraduationCap className="w-4 h-4" />
            Daftar Data Guru
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTeachers.length === 0 ? (
            <div className="text-center py-8">
<GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Belum Ada Data</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'Tidak ada guru yang cocok dengan pencarian' : 'Belum ada data guru yang ditambahkan'}
              </p>
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
                      <TableHead className="text-xs">Nama</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Telepon</TableHead>
                      <TableHead className="text-xs">Alamat</TableHead>
                      <TableHead className="text-xs">Mata Pelajaran</TableHead>
                      <TableHead className="text-xs">Jenis Kelamin</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-center text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedTeachers.map((teacher, index) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="text-muted-foreground text-xs">{startIndex + index + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{teacher.nip}</TableCell>
                        <TableCell className="font-medium text-xs">{teacher.nama}</TableCell>
                        <TableCell className="text-xs">{teacher.email || '-'}</TableCell>
                        <TableCell className="text-xs">{teacher.telepon || '-'}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={teacher.alamat || ''}>
                          {teacher.alamat || '-'}
                        </TableCell>
                        <TableCell>
                          {teacher.mata_pelajaran ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                              {teacher.mata_pelajaran}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {teacher.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={teacher.status === 'aktif' ? 'default' : 'secondary'}
                            className={`text-xs ${teacher.status === 'aktif' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                          >
                            {teacher.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
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
                                <AlertDialogTitle>Hapus Data Guru</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus data guru <strong>{teacher.nama}</strong>?
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
                <Card key={teacher.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{teacher.nama}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{teacher.nip}</p>
                      </div>
                      <div className="flex items-center gap-1">
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
                              <AlertDialogTitle>Hapus Data Guru</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus data guru <strong>{teacher.nama}</strong>?
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
                        <p className="font-medium">{teacher.email || '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Telepon:</span>
                        <p className="font-medium">{teacher.telepon || '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Jenis Kelamin:</span>
                        <p className="font-medium">{teacher.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <Badge 
                          variant={teacher.status === 'aktif' ? 'default' : 'secondary'}
                          className={`text-xs ${teacher.status === 'aktif' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                        >
                          {teacher.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </div>
                    </div>
                    
                    {teacher.mata_pelajaran && (
                      <div>
                        <span className="text-muted-foreground text-xs">Mata Pelajaran:</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs mt-1">
                          {teacher.mata_pelajaran}
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

export default ManageTeacherDataView;
