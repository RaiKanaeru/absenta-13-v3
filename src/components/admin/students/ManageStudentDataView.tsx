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
import { ArrowLeft, Download, Search, Users, Edit, Trash2 } from "lucide-react";
import ExcelImportView from "../../ExcelImportView";
import { StudentData, Kelas } from "@/types/dashboard";

type Gender = 'L' | 'P';
type StudentStatus = 'aktif' | 'nonaktif';

// ManageStudentDataView Component
const ManageStudentDataView = ({ onBack, onLogout }: Readonly<{ onBack: () => void; onLogout: () => void }>) => {
  const [formData, setFormData] = useState({ 
    nis: '', 
    nama: '', 
    kelas_id: '',
    jenis_kelamin: '' as Gender | '',
    alamat: '',
    telepon_orangtua: '',
    nomor_telepon_siswa: '',
    status: 'aktif' as StudentStatus,
    username: '',
    password: '',
    email: '',
    jabatan: 'Siswa'
  });
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchStudentsData = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/students-data', { onLogout });
      setStudentsData(data);
    } catch (error: any) {
      console.error('Error fetching students data:', error);
      toast({ title: "Error memuat data siswa", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/kelas', { onLogout });
      setClasses(data);
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      toast({ title: "Error memuat data kelas", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  useEffect(() => {
    fetchStudentsData();
    fetchClasses();
  }, [fetchStudentsData, fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // === VALIDASI CLIENT-SIDE (konsisten dengan Tambah Akun Siswa) ===
    // Required fields
    if (!formData.nis || !formData.nama) {
      toast({ title: "Error", description: "NIS dan Nama wajib diisi!", variant: "destructive" });
      return;
    }

    // NIS format: 8-20 digit angka
    if (!/^\d{8,20}$/.test(formData.nis)) {
      toast({ title: "Error", description: "NIS harus berupa angka 8-20 digit!", variant: "destructive" });
      return;
    }

    // Email format (jika diisi)
    if (formData.email && formData.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({ title: "Error", description: "Format email tidak valid!", variant: "destructive" });
      return;
    }

    // Telepon siswa format (jika diisi)
    if (formData.nomor_telepon_siswa && formData.nomor_telepon_siswa.trim() !== '' && !/^[\d+]{1,20}$/.test(formData.nomor_telepon_siswa.trim())) {
      toast({ title: "Error", description: "Nomor telepon siswa harus berupa angka, maksimal 20 karakter!", variant: "destructive" });
      return;
    }

    // Telepon orangtua format (jika diisi)
    if (formData.telepon_orangtua && formData.telepon_orangtua.trim() !== '' && !/^[\d+]{1,20}$/.test(formData.telepon_orangtua.trim())) {
      toast({ title: "Error", description: "Nomor telepon orangtua harus berupa angka, maksimal 20 karakter!", variant: "destructive" });
      return;
    }

    // Username format (jika diisi - untuk perwakilan kelas)
    if (formData.username && formData.username.trim() !== '' && !/^[a-zA-Z0-9._-]{4,32}$/.test(formData.username)) {
      toast({ title: "Error", description: "Username harus 4-32 karakter, hanya huruf, angka, titik, underscore, dan strip!", variant: "destructive" });
      return;
    }
    // === END VALIDASI ===

    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/students-data/${editingId}` : '/api/admin/students-data';
      const method = editingId ? 'PUT' : 'POST';
      
      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout
      });

      toast({ title: editingId ? "Data siswa berhasil diupdate!" : "Data siswa berhasil ditambahkan!" });
      setFormData({ 
        nis: '', 
        nama: '', 
        kelas_id: '',
        jenis_kelamin: '' as Gender | '',
        alamat: '',
        telepon_orangtua: '',
        nomor_telepon_siswa: '',
        status: 'aktif' as StudentStatus,
        username: '',
        password: '',
        email: '',
        jabatan: 'Siswa'
      });
      setEditingId(null);
      fetchStudentsData();
    } catch (error: any) {
      console.error('Error submitting student data:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleEdit = (student: StudentData) => {
    setFormData({ 
      nis: student.nis, 
      nama: student.nama, 
      kelas_id: student.kelas_id.toString(),
      jenis_kelamin: student.jenis_kelamin,
      alamat: student.alamat || '',
      telepon_orangtua: student.telepon_orangtua || '',
      nomor_telepon_siswa: student.nomor_telepon_siswa || '',
      status: student.status,
      username: student.username || '',
      password: '',
      email: student.email || '',
      jabatan: student.jabatan || 'Siswa'
    });
    setEditingId(student.id_siswa);
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!globalThis.confirm(`Yakin ingin menghapus data siswa "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/students-data/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({ title: `Data siswa ${nama} berhasil dihapus` });
      fetchStudentsData();
    } catch (error: any) {
      console.error('Error deleting student data:', error);
      toast({ title: "Error menghapus data siswa", description: error.message, variant: "destructive" });
    }
  };

  const filteredStudents = studentsData.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (student.nama && student.nama.toLowerCase().includes(searchLower)) ||
      (student.nis && student.nis.toLowerCase().includes(searchLower)) ||
      (student.nama_kelas && student.nama_kelas.toLowerCase().includes(searchLower))
    );
  });

  if (showImport) {
    return <ExcelImportView entityType="siswa" entityName="Data Siswa" onBack={() => setShowImport(false)} />;
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
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
              Kelola Data Siswa
            </h1>
            <p className="text-sm text-muted-foreground">Tambah dan kelola data lengkap siswa</p>
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
            <Users className="w-4 h-4" />
            {editingId ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="student-nis" className="text-sm font-medium">NIS *</Label>
                <Input 
                  id="student-nis" 
                  value={formData.nis} 
                  onChange={(e) => setFormData({...formData, nis: e.target.value})} 
                  placeholder="Nomor Induk Siswa"
                  className="mt-1"
                  required 
                />
              </div>
              <div>
                <Label htmlFor="student-nama" className="text-sm font-medium">Nama Lengkap *</Label>
                <Input 
                  id="student-nama" 
                  value={formData.nama} 
                  onChange={(e) => setFormData({...formData, nama: e.target.value})} 
                  placeholder="Nama lengkap siswa"
                  className="mt-1"
                  required 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="student-class" className="text-sm font-medium">Kelas *</Label>
                <Select value={formData.kelas_id} onValueChange={(value) => setFormData({...formData, kelas_id: value})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.filter(cls => cls.id).map((cls, index) => (
                      <SelectItem key={`class-filter-${cls.id}-${index}`} value={cls.id.toString()}>
                        {cls.nama_kelas}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="student-gender" className="text-sm font-medium">Jenis Kelamin *</Label>
                <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({...formData, jenis_kelamin: value as Gender})}>
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="student-telp" className="text-sm font-medium">Telepon Orang Tua</Label>
                <Input 
                  id="student-telp" 
                  value={formData.telepon_orangtua} 
                  onChange={(e) => setFormData({...formData, telepon_orangtua: e.target.value})} 
                  placeholder="Nomor telepon orang tua"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="student-phone" className="text-sm font-medium">Nomor Telepon Siswa</Label>
                <Input 
                  id="student-phone" 
                  value={formData.nomor_telepon_siswa || ''} 
                  onChange={(e) => setFormData({...formData, nomor_telepon_siswa: e.target.value})} 
                  placeholder="Nomor telepon pribadi siswa (10-15 digit)"
                  pattern="[0-9]{10,15}"
                  title="Nomor telepon harus berupa angka 10-15 digit"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="student-alamat" className="text-sm font-medium">Alamat</Label>
              <Textarea 
                id="student-alamat" 
                value={formData.alamat} 
                onChange={(e) => setFormData({...formData, alamat: e.target.value})} 
                placeholder="Alamat lengkap siswa"
                rows={2}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="student-status" className="text-sm font-medium">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as StudentStatus})}>
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
                  <Button type="submit" disabled={isLoading} className="bg-orange-600 hover:bg-orange-700 text-sm">
                {isLoading ? 'Menyimpan...' : (editingId ? 'Update' : 'Tambah')}
              </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={() => {
                      setEditingId(null);
                      setFormData({ 
                        nis: '', 
                        nama: '', 
                        kelas_id: '',
                        jenis_kelamin: '' as Gender | '',
                        alamat: '',
                        telepon_orangtua: '',
                        nomor_telepon_siswa: '',
                        status: 'aktif' as StudentStatus,
                        username: '',
                        password: '',
                        email: '',
                        jabatan: 'Siswa'
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama, NIS, atau kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredStudents.length} siswa ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Daftar Data Siswa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Tidak ada siswa yang cocok dengan pencarian' : 'Belum ada data siswa yang ditambahkan'}
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
                    <TableHead className="text-xs">NIS</TableHead>
                    <TableHead className="text-xs">Nama</TableHead>
                    <TableHead className="text-xs">Kelas</TableHead>
                    <TableHead className="text-xs">Jenis Kelamin</TableHead>
                    <TableHead className="text-xs">Alamat</TableHead>
                    <TableHead className="text-xs">Telepon Ortu</TableHead>
                    <TableHead className="text-xs">Telepon Siswa</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-center text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student, index) => (
                    <TableRow key={student.id_siswa}>
                      <TableCell className="text-gray-500 text-sm">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{student.nis}</TableCell>
                      <TableCell className="font-medium">{student.nama}</TableCell>
                      <TableCell>
                        {student.nama_kelas ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {student.nama_kelas}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {student.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-32 truncate" title={student.alamat}>
                        {student.alamat || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {student.telepon_orangtua || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {student.nomor_telepon_siswa || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={student.status === 'aktif' ? 'default' : 'secondary'}
                          className={student.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                        >
                          {student.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(student)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Data Siswa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus data siswa <strong>{student.nama}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(student.id_siswa, student.nama)}
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
              {filteredStudents.map((student, index) => (
                <Card key={student.id_siswa} className="p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{student.nama}</h3>
                        <p className="text-xs text-gray-500 font-mono">NIS: {student.nis}</p>
                      </div>
                      <div className="flex gap-1">
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
                              <AlertDialogTitle>Hapus Data Siswa</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus data siswa <strong>{student.nama}</strong>?
                                Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(student.id_siswa, student.nama)}
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
                        <span className="text-gray-500">Jenis Kelamin:</span>
                        <p>{student.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <Badge 
                          variant={student.status === 'aktif' ? 'default' : 'secondary'}
                          className={`text-xs ${student.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                        >
                          {student.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </div>
                    </div>
                    
                    {student.nama_kelas && (
                      <div>
                        <span className="text-gray-500 text-xs">Kelas:</span>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs ml-1">
                          {student.nama_kelas}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Telepon Ortu:</span>
                        <p className="font-mono">{student.telepon_orangtua || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Telepon Siswa:</span>
                        <p className="font-mono">{student.nomor_telepon_siswa || '-'}</p>
                      </div>
                    </div>
                    
                    {student.alamat && (
                      <div>
                        <span className="text-gray-500 text-xs">Alamat:</span>
                        <p className="text-xs mt-1">{student.alamat}</p>
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

export default ManageStudentDataView;
