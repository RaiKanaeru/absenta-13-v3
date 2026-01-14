import React, { useState, useEffect, useCallback } from 'react';
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
import { ArrowLeft, Download, Plus, Eye, EyeOff, Edit, Trash2, Home, Search } from "lucide-react";
import { apiCall } from '@/utils/apiClient';
import ExcelImportView from '../../ExcelImportView';
import { Student, Kelas } from '@/types/dashboard';

interface ManageStudentsViewProps {
  onBack: () => void;
  onLogout: () => void;
}

export const ManageStudentsView = ({ onBack, onLogout }: ManageStudentsViewProps) => {
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
    jabatan: 'Siswa'
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNis, setEditingNis] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      const response = await apiCall('/api/admin/students', { onLogout });
      // Backend returns { success, data, pagination } - extract the data array
      const studentsArray = response?.data || response || [];
      setStudents(Array.isArray(studentsArray) ? studentsArray : []);
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast({ title: "Error memuat data siswa", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);


  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/classes', { onLogout });
      setClasses(data);
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      // Don't show error toast for classes as it's not critical
    }
  }, [onLogout]);

  // Validasi form using declarative rules
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    // Define validation rules
    type ValidationRule = { field: string; condition: boolean; message: string };
    const rules: ValidationRule[] = [
      { field: 'nis', condition: !formData.nis || !/^\d{8,20}$/.test(formData.nis), message: 'NIS harus berupa angka 8-20 digit' },
      { field: 'nama', condition: !formData.nama || formData.nama.trim().length < 2, message: 'Nama lengkap wajib diisi minimal 2 karakter' },
      { field: 'kelas_id', condition: !formData.kelas_id, message: 'Kelas wajib dipilih' },
      { field: 'jenis_kelamin', condition: !formData.jenis_kelamin, message: 'Jenis kelamin wajib dipilih' },
      { field: 'username', condition: !formData.username || formData.username.trim().length < 3, message: 'Username wajib diisi minimal 3 karakter' },
      { field: 'password', condition: !editingId && (!formData.password || formData.password.length < 6), message: 'Password wajib diisi minimal 6 karakter' },
      { field: 'email', condition: !!formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email), message: 'Format email tidak valid' },
      { field: 'telepon_orangtua', condition: !!formData.telepon_orangtua && !/^[\d+]{1,20}$/.test(formData.telepon_orangtua), message: 'Nomor telepon orang tua harus berupa angka dan plus, maksimal 20 karakter' },
      { field: 'nomor_telepon_siswa', condition: !!formData.nomor_telepon_siswa && !/^[\d+]{1,20}$/.test(formData.nomor_telepon_siswa), message: 'Nomor telepon siswa harus berupa angka dan plus, maksimal 20 karakter' }
    ];
    
    // Apply validation rules
    rules.forEach(rule => {
      if (rule.condition) errors[rule.field] = rule.message;
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [fetchStudents, fetchClasses]);

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
      
      const submitData = {
        ...formData,
        kelas_id: Number.parseInt(formData.kelas_id),
      };

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
        jabatan: 'Siswa'
      });
      setFormErrors({});
      setEditingId(null);
      setEditingNis(null);
      setDialogOpen(false);
      fetchStudents();
    } catch (error: any) {
      console.error('Error submitting student:', error);
      if (error.details) {
        const errorMessage = Array.isArray(error.details) ? error.details.join(', ') : error.details;
        toast({ title: "Error Validasi", description: errorMessage, variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }

    setIsLoading(false);
  };

  const handleEdit = (student: Student) => {
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
      jabatan: student.jabatan || 'Siswa'
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
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast({ title: "Error menghapus data siswa", description: error.message, variant: "destructive" });
    }
  };

  const filteredStudents = students.filter(student => {
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
                  jabatan: 'Siswa'
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
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              boxSizing: 'border-box'
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-base">{editingId ? 'Edit Akun Siswa' : 'Tambah Akun Siswa'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nama">Nama Lengkap *</Label>
                  <Input
                    id="nama"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Masukkan nama lengkap"
                    className={formErrors.nama ? 'border-red-500' : ''}
                  />
                  {formErrors.nama && <p className="text-sm text-red-500 mt-1">{formErrors.nama}</p>}
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
                    className={formErrors.nis ? 'border-red-500' : ''}
                  />
                  {formErrors.nis && <p className="text-sm text-red-500 mt-1">{formErrors.nis}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="kelas_id">Kelas *</Label>
                  <Select value={formData.kelas_id} onValueChange={(value) => setFormData({ ...formData, kelas_id: value })}>
                    <SelectTrigger className={formErrors.kelas_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.filter(kelas => kelas.id).map((kelas, index) => (
                        <SelectItem key={`class-select-${kelas.id}-${index}`} value={kelas.id.toString()}>
                          {kelas.nama_kelas} {kelas.tingkat ? `(${kelas.tingkat})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.kelas_id && <p className="text-sm text-red-500 mt-1">{formErrors.kelas_id}</p>}
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
                      <SelectItem value="Wakil Ketua Kelas">Wakil Ketua Kelas</SelectItem>
                      <SelectItem value="Sekretaris Kelas">Sekretaris Kelas</SelectItem>
                      <SelectItem value="Bendahara Kelas">Bendahara Kelas</SelectItem>
                      <SelectItem value="Perwakilan Siswa">Perwakilan Siswa</SelectItem>
                      <SelectItem value="Ketua Murid">Ketua Murid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="jenis_kelamin">Jenis Kelamin *</Label>
                  <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value })}>
                    <SelectTrigger className={formErrors.jenis_kelamin ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.jenis_kelamin && <p className="text-sm text-red-500 mt-1">{formErrors.jenis_kelamin}</p>}
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
                    placeholder="Masukkan nomor telepon orang tua"
                    className={formErrors.telepon_orangtua ? 'border-red-500' : ''}
                  />
                  {formErrors.telepon_orangtua && <p className="text-sm text-red-500 mt-1">{formErrors.telepon_orangtua}</p>}
                </div>
                <div>
                  <Label htmlFor="nomor_telepon_siswa">Telepon Siswa</Label>
                  <Input
                    id="nomor_telepon_siswa"
                    value={formData.nomor_telepon_siswa}
                    onChange={(e) => setFormData({ ...formData, nomor_telepon_siswa: e.target.value })}
                    placeholder="Masukkan nomor telepon siswa"
                    className={formErrors.nomor_telepon_siswa ? 'border-red-500' : ''}
                  />
                  {formErrors.nomor_telepon_siswa && <p className="text-sm text-red-500 mt-1">{formErrors.nomor_telepon_siswa}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="alamat">Alamat</Label>
                <Input
                  id="alamat"
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  placeholder="Masukkan alamat lengkap"
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
                    editingId ? 'Simpan Perubahan' : 'Tambah Siswa'
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama, NIS..."
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
            <Home className="w-4 h-4" />
            Daftar Akun Siswa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <Home className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Tidak ada siswa yang cocok dengan pencarian' : 'Belum ada akun siswa yang ditambahkan'}
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
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="text-xs">{student.nis}</TableCell>
                        <TableCell className="font-medium text-xs">{student.nama}</TableCell>
                        <TableCell className="text-xs">{student.nama_kelas}</TableCell>
                        <TableCell className="text-xs">{student.jabatan || 'Siswa'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={student.status === 'aktif' ? 'default' : 'secondary'}
                            className={`text-xs ${student.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
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
                {filteredStudents.map((student) => (
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
                          <span className="text-gray-500 block">Kelas:</span>
                          <span className="font-medium">{student.nama_kelas}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Jabatan:</span>
                          <span className="font-medium">{student.jabatan || 'Siswa'}</span>
                        </div>
                      </div>
                      
                      <div>
                        <Badge 
                          variant={student.status === 'aktif' ? 'default' : 'secondary'}
                          className={`text-xs ${student.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
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
