import React, { useCallback, useEffect, useState } from "react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import type { Kelas } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import { ArrowLeft, Download, Edit, Home, Search, Trash2 } from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/ExcelImportView"));

export const ManageClassesView = ({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) => {
  const [formData, setFormData] = useState({ nama_kelas: "" });
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showImport, setShowImport] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall("/api/admin/kelas", { onLogout });
      setClasses(data as Kelas[]);
    } catch (error) {
      console.error("Error fetching classes:", error instanceof Error ? error.message : String(error));
      toast({
        title: "Error memuat kelas",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  }, [onLogout]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!formData.nama_kelas || formData.nama_kelas.trim() === "") {
      toast({ title: "Error", description: "Nama kelas wajib diisi!", variant: "destructive" });
      return;
    }
    if (!/^[A-Za-z0-9\s-]{2,30}$/.test(formData.nama_kelas.trim())) {
      toast({
        title: "Error",
        description: "Nama kelas harus 2-30 karakter, hanya huruf, angka, spasi, dan strip!",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/kelas/${editingId}` : "/api/admin/kelas";
      const method = editingId ? "PUT" : "POST";

      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout,
      });

      toast({ title: editingId ? "Kelas berhasil diupdate!" : "Kelas berhasil ditambahkan!" });
      setFormData({ nama_kelas: "" });
      setEditingId(null);
      fetchClasses();
    } catch (error) {
      console.error("Error submitting class:", error);
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }

    setIsLoading(false);
  };

  const handleEdit = (kelas: Kelas) => {
    setFormData({ nama_kelas: kelas.nama_kelas });
    setEditingId(kelas.id);
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!globalThis.confirm(`Yakin ingin menghapus kelas "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/kelas/${id}`, {
        method: "DELETE",
        onLogout,
      });

      toast({ title: `Kelas ${nama} berhasil dihapus` });
      fetchClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast({ title: "Error menghapus kelas", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const filteredClasses = classes.filter((kelas) => {
    const searchLower = searchTerm.toLowerCase();
    return kelas.nama_kelas && kelas.nama_kelas.toLowerCase().includes(searchLower);
  });

  if (showImport) {
    return <ExcelImportView entityType="kelas" entityName="Kelas" onBack={() => setShowImport(false)} />;
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
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 bg-clip-text text-transparent">
              Kelola Kelas
            </h1>
            <p className="text-sm text-muted-foreground">Tambah dan kelola kelas sekolah</p>
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
            <Home className="w-4 h-4" />
            {editingId ? "Edit Kelas" : "Tambah Kelas"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="class-name" className="text-sm font-medium">
                Nama Kelas *
              </Label>
              <Input
                id="class-name"
                value={formData.nama_kelas}
                onChange={(e) => setFormData({ ...formData, nama_kelas: e.target.value })}
                placeholder="Contoh: X IPA 1, XI IPS 2, XII IPA 3"
                className="mt-1"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Format: [Tingkat] [Jurusan] [Nomor] - contoh: X IPA 1</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-sm">
                {isLoading ? "Menyimpan..." : editingId ? "Update" : "Tambah"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ nama_kelas: "" });
                  }}
                  className="text-sm"
                >
                  Batal
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredClasses.length} kelas ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="w-4 h-4" />
            Daftar Kelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClasses.length === 0 ? (
            <div className="text-center py-8">
              <Home className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">Belum Ada Data</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Tidak ada kelas yang cocok dengan pencarian" : "Belum ada kelas yang ditambahkan"}
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
                      <TableHead className="text-xs">Nama Kelas</TableHead>
                      <TableHead className="text-xs">Tingkat</TableHead>
                      <TableHead className="text-center text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((kelas, index) => (
                      <TableRow key={kelas.id}>
                        <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium text-xs">{kelas.nama_kelas}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {kelas.tingkat || "Belum diatur"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(kelas)} className="h-7 w-7 p-0">
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
                                  <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus kelas <strong>{kelas.nama_kelas}</strong>? Tindakan ini tidak dapat
                                    dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(kelas.id, kelas.nama_kelas)} className="bg-red-600 hover:bg-red-700">
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
                {filteredClasses.map((kelas, index) => (
                  <Card key={kelas.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{kelas.nama_kelas}</h3>
                          <p className="text-xs text-muted-foreground">#{index + 1}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(kelas)} className="h-7 w-7 p-0">
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
                                <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus kelas <strong>{kelas.nama_kelas}</strong>? Tindakan ini tidak dapat
                                  dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(kelas.id, kelas.nama_kelas)} className="bg-red-600 hover:bg-red-700">
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-xs">Tingkat:</span>
                        <Badge variant="outline" className="text-xs mt-1">
                          {kelas.tingkat || "Belum diatur"}
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
