import React, { useCallback, useEffect, useMemo, useState } from "react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import type { Kelas } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import { ArrowDown, ArrowUp, ArrowUpDown, Edit, FileText, Home, Plus, Search, Trash2 } from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/ExcelImportView"));

type SortField = "nama_kelas" | "tingkat";
type SortDirection = "asc" | "desc";

const INITIAL_FORM_DATA = {
  nama_kelas: "",
};

export const ManageClassesView = ({
  onLogout,
}: {
  onLogout: () => void;
}) => {
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("nama_kelas");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiCall("/api/admin/kelas", { onLogout });
      setClasses(data as Kelas[]);
    } catch (error) {
      toast({
        title: "Error memuat kelas",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // --- Stats ---
  const stats = useMemo(() => {
    return {
      total: classes.length,
    };
  }, [classes]);

  // --- Filtered & Sorted Classes ---
  const filteredClasses = useMemo(() => {
    let result = classes;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (k) =>
          k.nama_kelas?.toLowerCase().includes(term) ||
          k.tingkat?.toString().toLowerCase().includes(term)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortField) {
        case "nama_kelas":
          valA = (a.nama_kelas || "").toLowerCase();
          valB = (b.nama_kelas || "").toLowerCase();
          break;
        case "tingkat":
          valA = a.tingkat || 0;
          valB = b.tingkat || 0;
          break;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [classes, searchTerm, sortField, sortDirection]);

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

  const openEditSheet = (kelas: Kelas) => {
    setFormData({
      nama_kelas: kelas.nama_kelas,
    });
    setEditingId(kelas.id);
    setSheetOpen(true);
  };

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

    setIsSaving(true);

    try {
      const url = editingId ? `/api/admin/kelas/${editingId}` : "/api/admin/kelas";
      const method = editingId ? "PUT" : "POST";

      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout,
      });

      toast({ title: editingId ? "Kelas berhasil diperbarui!" : "Kelas berhasil ditambahkan!" });
      setFormData(INITIAL_FORM_DATA);
      setEditingId(null);
      setSheetOpen(false);
      fetchClasses();
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    try {
      await apiCall(`/api/admin/kelas/${id}`, {
        method: "DELETE",
        onLogout,
      });

      toast({ title: "Berhasil", description: `Kelas ${nama} berhasil dihapus` });
      fetchClasses();
    } catch (error) {
      toast({ title: "Error menghapus kelas", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  if (showImport) {
    return <ExcelImportView entityType="kelas" entityName="Kelas" onBack={() => { setShowImport(false); fetchClasses(); }} />;
  }

  const editOrAddText = editingId ? "Perbarui" : "Tambah";
  const saveButtonText = isSaving ? "Menyimpan..." : editOrAddText;
  const isEmptyState = !isLoading && filteredClasses.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kelola Kelas</h2>
          <p className="text-sm text-muted-foreground">Tambah, edit, dan hapus data kelas</p>
        </div>
        <div className="flex flex-row gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Import Excel
          </Button>
          <Button onClick={openAddSheet} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Kelas
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Home className="h-4 w-4" />
                <span className="text-xs font-medium">Total Kelas</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Cari nama kelas atau tingkat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
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
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-16 ml-auto" />
                </div>
              ))}
            </div>
          )}
          {isEmptyState && (
            <div className="text-center py-12">
              <Home className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold text-muted-foreground mb-1">Belum Ada Data</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? "Tidak ada kelas yang cocok dengan pencarian"
                  : "Belum ada kelas yang ditambahkan"}
              </p>
              {!searchTerm && (
                <Button onClick={openAddSheet} size="sm" className="mt-4 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Tambah Kelas Pertama
                </Button>
              )}
            </div>
          )}
          {!isLoading && filteredClasses.length > 0 && (
            <>
              {/* Desktop Table - hidden on mobile */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-xs">#</TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("nama_kelas")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Nama Kelas {getSortIcon("nama_kelas")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("tingkat")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Tingkat {getSortIcon("tingkat")}
                        </button>
                      </TableHead>
                      <TableHead className="text-right text-xs">Aksi</TableHead>
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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditSheet(kelas)}
                              className="h-7 w-7 p-0"
                              title="Edit kelas"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Hapus kelas">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus kelas <strong>{kelas.nama_kelas}</strong>? Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(kelas.id, kelas.nama_kelas)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                {filteredClasses.map((kelas, index) => (
                  <div key={kelas.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">#{index + 1}</span>
                          <h3 className="font-medium text-sm">{kelas.nama_kelas}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSheet(kelas)}
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
                                Apakah Anda yakin ingin menghapus kelas <strong>{kelas.nama_kelas}</strong>? Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(kelas.id, kelas.nama_kelas)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        Tingkat: <Badge variant="outline" className="text-[10px] py-0">{kelas.tingkat || "Belum diatur"}</Badge>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer count */}
              <div className="px-4 py-3 border-t text-xs text-muted-foreground">
                Menampilkan {filteredClasses.length} dari {classes.length} kelas
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Sheet (Sidebar) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Kelas" : "Tambah Kelas"}</SheetTitle>
            <SheetDescription>
              {editingId ? "Perbarui informasi kelas" : "Tambahkan kelas baru ke sistem"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <Label htmlFor="nama_kelas" className="text-sm font-medium">
                Nama Kelas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nama_kelas"
                value={formData.nama_kelas}
                onChange={(e) => setFormData({ ...formData, nama_kelas: e.target.value })}
                placeholder="Contoh: X IPA 1, XI IPS 2"
                className="mt-1.5"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">Format: [Tingkat] [Jurusan] [Nomor]</p>
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
