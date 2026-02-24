import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { Kelas } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import {
  Edit,
  FileText,
  Home,
  MoreHorizontal,
  Plus,
  School,
  Trash2,
} from "lucide-react";

const ExcelImportView = React.lazy(
  () => import("@/components/admin/ExcelImportView")
);

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
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Kelas | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  // --- Handlers ---
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

  const openDeleteDialog = (kelas: Kelas) => {
    setDeleteTarget(kelas);
    setDeleteDialogOpen(true);
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

  // --- Column definitions ---
  const columns: ColumnDef<Kelas>[] = useMemo(
    () => [
      {
        id: "nomor",
        header: () => <span className="text-xs">#</span>,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.index + 1}</span>
        ),
        enableSorting: false,
        size: 48,
      },
      {
        accessorKey: "nama_kelas",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nama Kelas" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-xs">{row.original.nama_kelas}</span>
        ),
      },
      {
        accessorKey: "tingkat",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tingkat" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.tingkat || "Belum diatur"}
          </Badge>
        ),
      },
      {
        id: "aksi",
        header: () => <span className="text-xs text-right block">Aksi</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const kelas = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Buka menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() => openEditSheet(kelas)}
                    className="text-xs gap-2"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit Kelas
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => openDeleteDialog(kelas)}
                    className="text-xs gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Kelas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (showImport) {
    return (
      <ExcelImportView
        entityType="kelas"
        entityName="Kelas"
        onBack={() => {
          setShowImport(false);
          fetchClasses();
        }}
      />
    );
  }

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

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={classes}
        isLoading={isLoading}
        searchPlaceholder="Cari nama kelas atau tingkat..."
        emptyIcon={<Home className="w-12 h-12 text-muted-foreground/40" />}
        emptyTitle="Belum Ada Data"
        emptyDescription="Belum ada kelas yang ditambahkan"
        emptyAction={
          <Button onClick={openAddSheet} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Kelas Pertama
          </Button>
        }
        renderMobileRow={(kelas, index) => (
          <div key={kelas.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  <h3 className="font-medium text-sm">{kelas.nama_kelas}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Buka menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem
                      onClick={() => openEditSheet(kelas)}
                      className="text-xs gap-2"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit Kelas
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(kelas)}
                      className="text-xs gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Kelas
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                Tingkat:{" "}
                <Badge variant="outline" className="text-[10px] py-0">
                  {kelas.tingkat || "Belum diatur"}
                </Badge>
              </span>
            </div>
          </div>
        )}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kelas{" "}
              <strong>{deleteTarget?.nama_kelas}</strong>? Tindakan ini tidak
              dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget.id, deleteTarget.nama_kelas);
                  setDeleteTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Sheet (Sidebar) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Kelas" : "Tambah Kelas"}</SheetTitle>
            <SheetDescription>
              {editingId ? "Perbarui informasi kelas" : "Tambahkan kelas baru ke sistem"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-6 pb-6">
            {/* Section 1: Detail Kelas */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <School className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Detail Kelas</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="nama_kelas" className="text-sm font-medium">
                    Nama Kelas <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <School className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nama_kelas"
                      value={formData.nama_kelas}
                      onChange={(e) =>
                        setFormData({ ...formData, nama_kelas: e.target.value })
                      }
                      placeholder="Contoh: X IPA 1, XI IPS 2"
                      className="pl-9"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Format: [Tingkat] [Jurusan] [Nomor]
                  </p>
                </div>
              </div>
            </div>

            <SheetFooter className="pt-6 mt-6 border-t">
              <div className="flex w-full sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSheetOpen(false)}
                  className="w-full sm:w-auto text-sm"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto text-sm"
                >
                  {isSaving ? (
                    "Menyimpan..."
                  ) : (
                    <>
                      {editingId ? (
                        <Edit className="mr-2 w-4 h-4" />
                      ) : (
                        <Plus className="mr-2 w-4 h-4" />
                      )}
                      {editingId ? "Perbarui Data" : "Simpan Data"}
                    </>
                  )}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};
