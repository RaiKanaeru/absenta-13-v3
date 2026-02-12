import React, { useCallback, useEffect, useState } from "react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import type { Subject } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import { ArrowLeft, BookOpen, Download, Edit, Search, Trash2 } from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/ExcelImportView"));

export const ManageSubjectsView = ({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) => {
  const [formData, setFormData] = useState({
    kode_mapel: "",
    nama_mapel: "",
    deskripsi: "",
    status: "aktif" as "aktif" | "tidak_aktif",
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showImport, setShowImport] = useState(false);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await apiCall("/api/admin/mapel", { onLogout });
      setSubjects(data as Subject[]);
     } catch (error) {
       toast({
         title: "Error memuat mata pelajaran",
         description: error instanceof Error ? error.message : String(error),
         variant: "destructive",
       });
     }
  }, [onLogout]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!formData.kode_mapel || formData.kode_mapel.trim() === "") {
      toast({ title: "Error", description: "Kode mata pelajaran wajib diisi!", variant: "destructive" });
      return;
    }
    if (!formData.nama_mapel || formData.nama_mapel.trim() === "") {
      toast({ title: "Error", description: "Nama mata pelajaran wajib diisi!", variant: "destructive" });
      return;
    }
    if (!/^[A-Za-z0-9]{2,10}$/.test(formData.kode_mapel.trim())) {
      toast({ title: "Error", description: "Kode mapel harus 2-10 karakter alfanumerik!", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const url = editingId ? `/api/admin/mapel/${editingId}` : "/api/admin/mapel";
      const method = editingId ? "PUT" : "POST";

      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout,
      });

      toast({ title: editingId ? "Mata pelajaran berhasil diupdate!" : "Mata pelajaran berhasil ditambahkan!" });
      setFormData({
        kode_mapel: "",
        nama_mapel: "",
        deskripsi: "",
        status: "aktif",
      });
      setEditingId(null);
      fetchSubjects();
     } catch (error) {
       toast({
         title: "Error",
         description: error instanceof Error ? error.message : String(error),
         variant: "destructive",
       });
     }

    setIsLoading(false);
  };

  const handleEdit = (subject: Subject) => {
    setFormData({
      kode_mapel: subject.kode_mapel,
      nama_mapel: subject.nama_mapel,
      deskripsi: subject.deskripsi || "",
      status: subject.status || "aktif",
    });
    setEditingId(subject.id);
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!globalThis.confirm(`Yakin ingin menghapus mata pelajaran "${nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/mapel/${id}`, {
        method: "DELETE",
        onLogout,
      });

      toast({ title: `Mata pelajaran ${nama} berhasil dihapus` });
      fetchSubjects();
     } catch (error) {
       toast({
         title: "Error menghapus mata pelajaran",
         description: getErrorMessage(error),
         variant: "destructive",
       });
     }
  };

  const filteredSubjects = subjects.filter((subject) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      subject.nama_mapel?.toLowerCase().includes(searchLower) ||
      subject.kode_mapel?.toLowerCase().includes(searchLower) ||
      subject.deskripsi?.toLowerCase().includes(searchLower)
    );
  });

  let submitLabel = "Tambah";
  if (editingId) {
    submitLabel = "Update";
  }
  if (isLoading) {
    submitLabel = "Menyimpan...";
  }

  if (showImport) {
    return <ExcelImportView entityType="mapel" entityName="Mata Pelajaran" onBack={() => setShowImport(false)} />;
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
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
              Kelola Mata Pelajaran
            </h1>
            <p className="text-sm text-muted-foreground">Tambah dan kelola mata pelajaran sekolah</p>
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
            <BookOpen className="w-4 h-4" />
            {editingId ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="subject-code" className="text-sm font-medium">
                  Kode Mata Pelajaran *
                </Label>
                <Input
                  id="subject-code"
                  value={formData.kode_mapel}
                  onChange={(e) => setFormData({ ...formData, kode_mapel: e.target.value })}
                  placeholder="Misal: MAT, FIS, BIO"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="subject-name" className="text-sm font-medium">
                  Nama Mata Pelajaran *
                </Label>
                <Input
                  id="subject-name"
                  value={formData.nama_mapel}
                  onChange={(e) => setFormData({ ...formData, nama_mapel: e.target.value })}
                  placeholder="Nama lengkap mata pelajaran"
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="subject-desc" className="text-sm font-medium">
                Deskripsi
              </Label>
              <textarea
                id="subject-desc"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none mt-1"
                value={formData.deskripsi}
                onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                placeholder="Deskripsi mata pelajaran (opsional)"
              />
            </div>

            <div>
              <Label htmlFor="subject-status" className="text-sm font-medium">
                Status *
              </Label>
              <select
                id="subject-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "aktif" | "tidak_aktif" })}
                required
              >
                <option value="aktif">Aktif</option>
                <option value="tidak_aktif">Tidak Aktif</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-sm">
                {submitLabel}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      kode_mapel: "",
                      nama_mapel: "",
                      deskripsi: "",
                      status: "aktif",
                    });
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
                placeholder="Cari berdasarkan nama, kode, atau deskripsi mata pelajaran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <Badge variant="secondary" className="px-2 py-1 text-xs whitespace-nowrap">
              {filteredSubjects.length} mata pelajaran ditemukan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4" />
            Daftar Mata Pelajaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubjects.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">Belum Ada Data</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Tidak ada mata pelajaran yang cocok dengan pencarian" : "Belum ada mata pelajaran yang ditambahkan"}
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
                      <TableHead className="text-xs">Kode</TableHead>
                      <TableHead className="text-xs">Nama Mata Pelajaran</TableHead>
                      <TableHead className="text-xs">Deskripsi</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-center text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubjects.map((subject, index) => (
                      <TableRow key={subject.id}>
                        <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs bg-muted rounded px-2 py-1 max-w-20">{subject.kode_mapel}</TableCell>
                        <TableCell className="font-medium text-xs">{subject.nama_mapel}</TableCell>
                        <TableCell className="text-xs max-w-40 truncate" title={subject.deskripsi}>
                          {subject.deskripsi || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={subject.status === "aktif" ? "default" : "secondary"}
                            className={`text-xs ${subject.status === "aktif" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                          >
                            {subject.status === "aktif" ? "Aktif" : "Tidak Aktif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(subject)}
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
                                  <AlertDialogTitle>Hapus Mata Pelajaran</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus mata pelajaran <strong>{subject.nama_mapel}</strong>?
                                    Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(subject.id, subject.nama_mapel)}
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
                {filteredSubjects.map((subject, index) => (
                  <Card key={subject.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{subject.nama_mapel}</h3>
                          <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-2 py-1 inline-block mt-1">{subject.kode_mapel}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(subject)}
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
                                <AlertDialogTitle>Hapus Mata Pelajaran</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Apakah Anda yakin ingin menghapus mata pelajaran <strong>{subject.nama_mapel}</strong>?
                                  Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(subject.id, subject.nama_mapel)}
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
                          <span className="text-muted-foreground">Status:</span>
                          <Badge
                            variant={subject.status === "aktif" ? "default" : "secondary"}
                            className={`text-xs mt-1 ${subject.status === "aktif" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                          >
                            {subject.status === "aktif" ? "Aktif" : "Tidak Aktif"}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">No:</span>
                          <p className="font-medium">#{index + 1}</p>
                        </div>
                      </div>

                      {subject.deskripsi && (
                        <div>
                          <span className="text-muted-foreground">Deskripsi:</span>
                          <p className="text-xs mt-1">{subject.deskripsi}</p>
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
