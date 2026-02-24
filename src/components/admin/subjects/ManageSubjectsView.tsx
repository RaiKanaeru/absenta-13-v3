import React, { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Subject } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import {
  AlignLeft,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Edit,
  FileText,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";

const ExcelImportView = React.lazy(
  () => import("@/components/admin/ExcelImportView")
);

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
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

  // --- Filtered data for DataTable (status filter applied externally) ---
  const filteredData = useMemo(() => {
    if (statusFilter === "semua") return subjects;
    return subjects.filter((s) => s.status === statusFilter);
  }, [subjects, statusFilter]);

  // --- Handlers ---
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
    return (
      <ExcelImportView
        entityType="mapel"
        entityName="Mata Pelajaran"
        onBack={() => { setShowImport(false); fetchSubjects(); }}
      />
    );
  }

  // --- Column Definitions ---
  const columns: ColumnDef<Subject>[] = [
    {
      accessorKey: "kode_mapel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kode Mapel" />
      ),
      cell: ({ row }) => (
        <span className="font-mono font-medium text-xs bg-muted/50 rounded px-2 py-1">
          {row.getValue("kode_mapel")}
        </span>
      ),
    },
    {
      accessorKey: "nama_mapel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nama Mata Pelajaran" />
      ),
      cell: ({ row }) => (
        <span className="text-xs font-medium">{row.getValue("nama_mapel")}</span>
      ),
    },
    {
      accessorKey: "deskripsi",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Deskripsi" />
      ),
      cell: ({ row }) => {
        const deskripsi = row.getValue<string | undefined>("deskripsi");
        return (
          <span
            className="text-xs max-w-[200px] truncate block"
            title={deskripsi ?? ""}
          >
            {deskripsi || "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const subject = row.original;
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(subject)}
            className="cursor-pointer"
            title={`Klik untuk ${subject.status === "aktif" ? "nonaktifkan" : "aktifkan"}`}
          >
            <Badge
              variant={subject.status === "aktif" ? "default" : "secondary"}
              className={`text-xs transition-opacity hover:opacity-80 ${
                subject.status === "aktif"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : ""
              }`}
            >
              {subject.status === "aktif" ? "Aktif" : "Tidak Aktif"}
            </Badge>
          </button>
        );
      },
    },
    {
      id: "aksi",
      header: () => <span className="text-xs font-medium">Aksi</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const subject = row.original;
        return (
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Buka menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => openEditSheet(subject)}
                  className="text-xs gap-2"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-xs gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                <AlertDialogDescription>
                  Apakah Anda yakin ingin menghapus mata pelajaran{" "}
                  <strong>{subject.nama_mapel}</strong>? Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(subject.id, subject.nama_mapel)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
    },
  ];

  // --- Status Filter Buttons (toolbarContent) ---
  const statusFilterButtons = (
    <div className="flex items-center gap-1 overflow-x-auto">
      {(
        [
          { label: "Semua", value: "semua" as StatusFilter, count: stats.total },
          { label: "Aktif", value: "aktif" as StatusFilter, count: stats.aktif },
          { label: "Tidak Aktif", value: "tidak_aktif" as StatusFilter, count: stats.tidakAktif },
        ] as { label: string; value: StatusFilter; count: number }[]
      ).map((btn) => (
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
  );

  // --- Mobile Row Renderer ---
  const renderMobileRow = (subject: Subject) => (
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
                className={`text-[10px] py-0 transition-opacity hover:opacity-80 ${
                  subject.status === "aktif"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                    : ""
                }`}
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
                  Apakah Anda yakin ingin menghapus mata pelajaran{" "}
                  <strong>{subject.nama_mapel}</strong>? Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(subject.id, subject.nama_mapel)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
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
  );

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
            <Card key={i}>
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

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        searchPlaceholder="Cari kode, nama, atau deskripsi..."
        toolbarContent={statusFilterButtons}
        emptyIcon={<BookOpen className="w-12 h-12 text-muted-foreground/40" />}
        emptyTitle="Belum Ada Data"
        emptyDescription={
          statusFilter !== "semua"
            ? "Tidak ada mata pelajaran yang cocok dengan filter"
            : "Belum ada mata pelajaran yang ditambahkan"
        }
        emptyAction={
          statusFilter === "semua" ? (
            <Button onClick={openAddSheet} size="sm" className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Tambah Mapel Pertama
            </Button>
          ) : undefined
        }
        renderMobileRow={renderMobileRow}
        pageSizeOptions={[10, 15, 20, 30, 50]}
      />

      {/* Add/Edit Sheet (Sidebar) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}</SheetTitle>
            <SheetDescription>
              {editingId ? "Perbarui informasi mata pelajaran" : "Tambahkan mata pelajaran baru ke sistem"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-6 pb-6">

            {/* Section 1: Detail Mata Pelajaran */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <BookMarked className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Detail Mata Pelajaran</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="kode_mapel" className="text-sm font-medium">
                    Kode Mata Pelajaran <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="kode_mapel"
                      value={formData.kode_mapel}
                      onChange={(e) => setFormData({ ...formData, kode_mapel: e.target.value.toUpperCase() })}
                      placeholder="Misal: MAT, FIS, BIO"
                      className="pl-9"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">2-10 karakter alfanumerik</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="nama_mapel" className="text-sm font-medium">
                    Nama Mata Pelajaran <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <BookMarked className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nama_mapel"
                      value={formData.nama_mapel}
                      onChange={(e) => setFormData({ ...formData, nama_mapel: e.target.value })}
                      placeholder="Nama mapel"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="deskripsi" className="text-sm font-medium">
                    Deskripsi
                  </Label>
                  <div className="relative mt-1.5">
                    <AlignLeft className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <textarea
                      id="deskripsi"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      value={formData.deskripsi}
                      onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                      placeholder="Deskripsi singkat (opsional)"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Status */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Status Mata Pelajaran</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="status" className="text-sm font-medium">
                    Status
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value as "aktif" | "tidak_aktif" })
                      }
                    >
                      <SelectTrigger className="pl-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aktif">Aktif</SelectItem>
                        <SelectItem value="tidak_aktif">Tidak Aktif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto text-sm">
                  {isSaving ? "Menyimpan..." : (
                    <>
                      {editingId ? <Edit className="mr-2 w-4 h-4" /> : <Plus className="mr-2 w-4 h-4" />}
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
