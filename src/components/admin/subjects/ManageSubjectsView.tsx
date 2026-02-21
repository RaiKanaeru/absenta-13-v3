import React, { useCallback, useEffect, useMemo, useState } from "react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import type { Subject } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, CheckCircle2, Edit, FileText, Plus, Search, Trash2, XCircle } from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/ExcelImportView"));

type SortField = "kode_mapel" | "nama_mapel" | "deskripsi" | "status";
type SortDirection = "asc" | "desc";
type StatusFilter = "semua" | "aktif" | "tidak_aktif";

const INITIAL_FORM_DATA = {
  kode_mapel: "",
  nama_mapel: "",
  deskripsi: "",
  status: "aktif" as "aktif" | "tidak_aktif",
};

export const ManageSubjectsView = ({
  onLogout,
}: {
  onLogout: () => void;
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [sortField, setSortField] = useState<SortField>("kode_mapel");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiCall("/api/admin/mapel", { onLogout });
      setSubjects(data as Subject[]);
    } catch (error) {
      toast({
        title: "Error memuat mata pelajaran",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // --- Stats ---
  const stats = useMemo(() => {
    const total = subjects.length;
    const aktif = subjects.filter((s) => s.status === "aktif").length;
    const tidakAktif = total - aktif;
    return { total, aktif, tidakAktif };
  }, [subjects]);

  // --- Filtered & Sorted Subjects ---
  const filteredSubjects = useMemo(() => {
    let result = subjects;

    // Status filter
    if (statusFilter !== "semua") {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.nama_mapel?.toLowerCase().includes(term) ||
          s.kode_mapel?.toLowerCase().includes(term) ||
          s.deskripsi?.toLowerCase().includes(term)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortField) {
        case "kode_mapel":
          valA = (a.kode_mapel || "").toLowerCase();
          valB = (b.kode_mapel || "").toLowerCase();
          break;
        case "nama_mapel":
          valA = (a.nama_mapel || "").toLowerCase();
          valB = (b.nama_mapel || "").toLowerCase();
          break;
        case "deskripsi":
          valA = (a.deskripsi || "").toLowerCase();
          valB = (b.deskripsi || "").toLowerCase();
          break;
        case "status":
          valA = a.status || "";
          valB = b.status || "";
          break;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [subjects, searchTerm, statusFilter, sortField, sortDirection]);

  // --- Handlers ---
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline-block" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline-block" />
      : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
  };

  const openAddSheet = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEditSheet = (subject: Subject) => {
    setFormData({
      kode_mapel: subject.kode_mapel,
      nama_mapel: subject.nama_mapel,
      deskripsi: subject.deskripsi || "",
      status: subject.status || "aktif",
    });
    setEditingId(subject.id);
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    setIsSaving(true);

    try {
      const url = editingId ? `/api/admin/mapel/${editingId}` : "/api/admin/mapel";
      const method = editingId ? "PUT" : "POST";

      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout,
      });

      toast({ title: "Berhasil", description: editingId ? "Mata pelajaran berhasil diperbarui" : "Mata pelajaran berhasil ditambahkan" });
      setFormData(INITIAL_FORM_DATA);
      setEditingId(null);
      setSheetOpen(false);
      fetchSubjects();
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (subject: Subject) => {
    const newStatus = subject.status === "aktif" ? "tidak_aktif" : "aktif";
    try {
      await apiCall(`/api/admin/mapel/${subject.id}`, {
        method: "PUT",
        body: JSON.stringify({
          kode_mapel: subject.kode_mapel,
          nama_mapel: subject.nama_mapel,
          deskripsi: subject.deskripsi,
          status: newStatus,
        }),
        onLogout,
      });
      toast({
        title: "Status diperbarui",
        description: `${subject.nama_mapel} sekarang ${newStatus === "aktif" ? "Aktif" : "Tidak Aktif"}`,
      });
      fetchSubjects();
    } catch (error) {
      toast({
        title: "Gagal mengubah status",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    try {
      await apiCall(`/api/admin/mapel/${id}`, {
        method: "DELETE",
        onLogout,
      });
      toast({ title: "Berhasil", description: `Mata pelajaran ${nama} berhasil dihapus` });
      fetchSubjects();
    } catch (error) {
      toast({
        title: "Error menghapus mata pelajaran",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  if (showImport) {
    return <ExcelImportView entityType="mapel" entityName="Mata Pelajaran" onBack={() => { setShowImport(false); fetchSubjects(); }} />;
  }

  const statusFilterButtons: { label: string; value: StatusFilter; count: number }[] = [
    { label: "Semua", value: "semua", count: stats.total },
    { label: "Aktif", value: "aktif", count: stats.aktif },
    { label: "Tidak Aktif", value: "tidak_aktif", count: stats.tidakAktif },
  ];

  const editOrAddText = editingId ? "Perbarui" : "Tambah";
  const saveButtonText = isSaving ? "Menyimpan..." : editOrAddText;
  const isEmptyState = !isLoading && filteredSubjects.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kelola Mata Pelajaran</h2>
          <p className="text-sm text-muted-foreground">Tambah, edit, dan hapus data mata pelajaran</p>
        </div>
        <div className="flex flex-row gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Import Excel
          </Button>
          <Button onClick={openAddSheet} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Mata Pelajaran
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={`stat-skeleton-${i}`}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BookOpen className="h-4 w-4" />
                <span className="text-xs font-medium">Total Mata Pelajaran</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Mapel Aktif</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.aktif}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Mapel Tidak Aktif</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{stats.tidakAktif}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Filter */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Cari kode, nama, atau deskripsi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {statusFilterButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={statusFilter === btn.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(btn.value)}
                  className="text-xs h-9 px-3 whitespace-nowrap"
                >
                  {btn.label}
                  <Badge
                    variant={statusFilter === btn.value ? "outline" : "secondary"}
                    className="ml-1.5 px-1.5 py-0 text-[10px] min-w-[18px] justify-center"
                  >
                    {btn.count}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table / Data */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`row-skeleton-${i}`} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40 hidden sm:block" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-7 w-16 ml-auto" />
                </div>
              ))}
            </div>
          )}
          {isEmptyState && (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold text-muted-foreground mb-1">Belum Ada Data</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "semua"
                  ? "Tidak ada mata pelajaran yang cocok dengan filter"
                  : "Belum ada mata pelajaran yang ditambahkan"}
              </p>
              {!searchTerm && statusFilter === "semua" && (
                <Button onClick={openAddSheet} size="sm" className="mt-4 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Tambah Mapel Pertama
                </Button>
              )}
            </div>
          )}
          {!isLoading && filteredSubjects.length > 0 && (
            <>
              {/* Desktop Table - hidden on mobile */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("kode_mapel")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Kode Mapel {getSortIcon("kode_mapel")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("nama_mapel")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Nama Mata Pelajaran {getSortIcon("nama_mapel")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("deskripsi")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Deskripsi {getSortIcon("deskripsi")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("status")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Status {getSortIcon("status")}
                        </button>
                      </TableHead>
                      <TableHead className="text-right text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubjects.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="font-mono font-medium text-xs bg-muted/50 rounded px-2 py-1 max-w-[80px]">
                          {subject.kode_mapel}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{subject.nama_mapel}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={subject.deskripsi}>
                          {subject.deskripsi || "-"}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(subject)}
                            className="cursor-pointer"
                            title={`Klik untuk ${subject.status === "aktif" ? "nonaktifkan" : "aktifkan"}`}
                          >
                            <Badge
                              variant={subject.status === "aktif" ? "default" : "secondary"}
                              className={`text-xs transition-opacity hover:opacity-80 ${subject.status === "aktif" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : ""}`}
                            >
                              {subject.status === "aktif" ? "Aktif" : "Tidak Aktif"}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditSheet(subject)}
                              className="h-7 w-7 p-0"
                              title="Edit mapel"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Hapus mapel">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus mata pelajaran <strong>{subject.nama_mapel}</strong>? Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(subject.id, subject.nama_mapel)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
              <div className="lg:hidden divide-y">
                {filteredSubjects.map((subject) => (
                  <div key={subject.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{subject.nama_mapel}</h3>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(subject)}
                            className="cursor-pointer"
                          >
                            <Badge
                              variant={subject.status === "aktif" ? "default" : "secondary"}
                              className={`text-[10px] py-0 transition-opacity hover:opacity-80 ${subject.status === "aktif" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : ""}`}
                            >
                              {subject.status === "aktif" ? "Aktif" : "Tidak Aktif"}
                            </Badge>
                          </button>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{subject.kode_mapel}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSheet(subject)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin menghapus mata pelajaran <strong>{subject.nama_mapel}</strong>? Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(subject.id, subject.nama_mapel)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    {subject.deskripsi && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{subject.deskripsi}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer count */}
              <div className="px-4 py-3 border-t text-xs text-muted-foreground">
                Menampilkan {filteredSubjects.length} dari {subjects.length} mata pelajaran
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Sheet (Sidebar) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}</SheetTitle>
            <SheetDescription>
              {editingId ? "Perbarui informasi mata pelajaran" : "Tambahkan mata pelajaran baru ke sistem"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <Label htmlFor="kode_mapel" className="text-sm font-medium">
                Kode Mata Pelajaran <span className="text-destructive">*</span>
              </Label>
              <Input
                id="kode_mapel"
                value={formData.kode_mapel}
                onChange={(e) => setFormData({ ...formData, kode_mapel: e.target.value.toUpperCase() })}
                placeholder="Misal: MAT, FIS, BIO"
                className="mt-1.5"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">2-10 karakter alfanumerik</p>
            </div>
            <div>
              <Label htmlFor="nama_mapel" className="text-sm font-medium">
                Nama Mata Pelajaran <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nama_mapel"
                value={formData.nama_mapel}
                onChange={(e) => setFormData({ ...formData, nama_mapel: e.target.value })}
                placeholder="Nama lengkap mata pelajaran"
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="deskripsi" className="text-sm font-medium">
                Deskripsi
              </Label>
              <textarea
                id="deskripsi"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none mt-1.5"
                value={formData.deskripsi}
                onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                placeholder="Deskripsi singkat (opsional)"
              />
            </div>
            <div>
              <Label htmlFor="status" className="text-sm font-medium">
                Status
              </Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as "aktif" | "tidak_aktif" })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="tidak_aktif">Tidak Aktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="text-sm">
                Batal
              </Button>
              <Button type="submit" disabled={isSaving} className="text-sm">
                {saveButtonText}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};
