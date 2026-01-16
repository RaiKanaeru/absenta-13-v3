import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Home, Edit, Trash2, Plus, FileText, Search 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiCall } from '@/utils/apiClient';
import { Room } from '@/types/dashboard';
import { getSubmitButtonLabel } from '../utils/dashboardHelpers';

const ExcelImportView = React.lazy(() => import('../../ExcelImportView'));

const ManageRoomsView = ({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState({
    kode_ruang: '',
    nama_ruang: '',
    lokasi: '',
    kapasitas: '',
    status: 'aktif'
  });

  const fetchRooms = useCallback(async () => {
    try {
      const response = await apiCall('/api/admin/ruang', { onLogout });
      setRooms(response);
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      toast({ title: "Error memuat data ruang", description: error.message, variant: "destructive" });
    }
  }, [onLogout]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.kode_ruang || formData.kode_ruang.trim() === '') {
      toast({ title: "Error", description: "Kode ruang wajib diisi!", variant: "destructive" });
      return;
    }
    if (!/^[A-Za-z0-9]{2,20}$/.test(formData.kode_ruang.trim())) {
      toast({ title: "Error", description: "Kode ruang harus 2-20 karakter alfanumerik!", variant: "destructive" });
      return;
    }
    if (formData.kapasitas && (Number.isNaN(Number.parseInt(formData.kapasitas)) || Number.parseInt(formData.kapasitas) <= 0)) {
      toast({ title: "Error", description: "Kapasitas harus berupa angka positif!", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    try {
      if (editingId) {
        // Update existing room
        await apiCall(`/api/admin/ruang/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            kode_ruang: formData.kode_ruang,
            nama_ruang: formData.nama_ruang,
            lokasi: formData.lokasi,
            kapasitas: formData.kapasitas ? Number.parseInt(formData.kapasitas) : null,
            status: formData.status
          }),
          onLogout
        });

        toast({
          title: "Berhasil",
          description: "Ruang berhasil diperbarui"
        });
      } else {
        // Create new room
        await apiCall('/api/admin/ruang', {
          method: 'POST',
          body: JSON.stringify({
            kode_ruang: formData.kode_ruang,
            nama_ruang: formData.nama_ruang,
            lokasi: formData.lokasi,
            kapasitas: formData.kapasitas ? Number.parseInt(formData.kapasitas) : null,
            status: formData.status
          }),
          onLogout
        });

        toast({
          title: "Berhasil",
          description: "Ruang berhasil ditambahkan"
        });
      }

      // Reset form
      setFormData({
        kode_ruang: '',
        nama_ruang: '',
        lokasi: '',
        kapasitas: '',
        status: 'aktif'
      });
      setEditingId(null);
      setDialogOpen(false);
      fetchRooms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (room: Room) => {
    setFormData({
      kode_ruang: room.kode_ruang,
      nama_ruang: room.nama_ruang || '',
      lokasi: room.lokasi || '',
      kapasitas: room.kapasitas?.toString() || '',
      status: room.status
    });
    setEditingId(room.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await apiCall(`/api/admin/ruang/${id}`, {
        method: 'DELETE',
        onLogout
      });

      toast({
        title: "Berhasil",
        description: "Ruang berhasil dihapus"
      });
      fetchRooms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.kode_ruang.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.nama_ruang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.lokasi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showImport) {
    return <ExcelImportView entityType="ruang" entityName="Ruang Kelas" onBack={() => setShowImport(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Kelola Ruang Kelas</h2>
          <p className="text-sm text-gray-600">Tambah, edit, dan hapus data ruang kelas</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={onBack} variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Kembali
          </Button>
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Import Excel
          </Button>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Tambah Ruang
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cari ruang kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredRooms.length} ruang ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="w-4 h-4" />
            Daftar Ruang Kelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRooms.length === 0 ? (
            <div className="text-center py-8">
              <Home className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Tidak ada ruang yang cocok dengan pencarian' : 'Belum ada ruang kelas yang ditambahkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - hidden on mobile and tablet */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Kode Ruang</TableHead>
                      <TableHead className="text-xs">Nama Ruang</TableHead>
                      <TableHead className="text-xs">Lokasi</TableHead>
                      <TableHead className="text-xs">Kapasitas</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-right text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRooms.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium text-xs">{room.kode_ruang}</TableCell>
                        <TableCell className="text-xs">{room.nama_ruang || '-'}</TableCell>
                        <TableCell className="text-xs">{room.lokasi || '-'}</TableCell>
                        <TableCell className="text-xs">{room.kapasitas || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={room.status === 'aktif' ? 'default' : 'secondary'} className="text-xs">
                            {room.status === 'aktif' ? 'Aktif' : 'Tidak Aktif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(room)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus ruang {room.kode_ruang}? 
                                    Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(room.id)}>
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
                {filteredRooms.map((room) => (
                  <Card key={room.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{room.kode_ruang}</h3>
                          <p className="text-xs text-gray-500">{room.nama_ruang || 'Tidak ada nama'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(room)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus ruang {room.kode_ruang}? 
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(room.id)}>
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Lokasi:</span>
                          <p className="font-medium">{room.lokasi || '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Kapasitas:</span>
                          <p className="font-medium">{room.kapasitas || '-'}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Status:</span>
                          <div className="mt-1">
                            <Badge variant={room.status === 'aktif' ? 'default' : 'secondary'} className="text-xs">
                              {room.status === 'aktif' ? 'Aktif' : 'Tidak Aktif'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingId ? 'Edit Ruang Kelas' : 'Tambah Ruang Kelas'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingId ? 'Perbarui informasi ruang kelas' : 'Tambahkan ruang kelas baru'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="kode_ruang" className="text-sm font-medium">Kode Ruang *</Label>
                <Input
                  id="kode_ruang"
                  value={formData.kode_ruang}
                  onChange={(e) => setFormData({ ...formData, kode_ruang: e.target.value.toUpperCase() })}
                  placeholder="R34"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="nama_ruang" className="text-sm font-medium">Nama Ruang</Label>
                <Input
                  id="nama_ruang"
                  value={formData.nama_ruang}
                  onChange={(e) => setFormData({ ...formData, nama_ruang: e.target.value })}
                  placeholder="Ruang 34"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lokasi" className="text-sm font-medium">Lokasi</Label>
                <Input
                  id="lokasi"
                  value={formData.lokasi}
                  onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                  placeholder="Gedung A Lantai 3"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="kapasitas" className="text-sm font-medium">Kapasitas</Label>
                <Input
                  id="kapasitas"
                  type="number"
                  value={formData.kapasitas}
                  onChange={(e) => setFormData({ ...formData, kapasitas: e.target.value })}
                  placeholder="30"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status" className="text-sm font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="tidak_aktif">Tidak Aktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="text-sm">
                Batal
              </Button>
              <Button type="submit" disabled={isLoading} className="text-sm">
                {getSubmitButtonLabel(isLoading, editingId, 'Menyimpan...', 'Perbarui', 'Tambah')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageRoomsView;
