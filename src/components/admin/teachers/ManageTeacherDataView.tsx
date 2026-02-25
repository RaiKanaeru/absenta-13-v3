import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Subject, TeacherData } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import {
  BookOpen,
  CheckCircle2,
  Edit,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Badge as BadgeIcon,
  ShieldCheck,
  Trash2,
  UserCircle,
  Users,
  XCircle,
} from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/admin/ExcelImportView"));

type StatusFilter = "semua" | "aktif" | "nonaktif";
type GenderOption = "L" | "P" | "";

const INITIAL_FORM_DATA = {
  nip: "",
  nama: "",
  email: "",
  mata_pelajaran: "",
  alamat: "",
  telepon: "",
  jenis_kelamin: "" as GenderOption,
  status: "aktif" as "aktif" | "nonaktif",
};

interface TeachersDataResponse {
  data: TeacherData[];
  pagination: unknown;
}

const getGenderDisplay = (jk: string) => {
  if (jk === "L") return "Laki-laki";
  if (jk === "P") return "Perempuan";
  return "-";
};

const getSubmitButtonText = (isSaving: boolean, isEditing: boolean) => {
  if (isSaving) return "Menyimpan...";
  if (isEditing) return "Perbarui";
  return "Simpan";
};

export const ManageTeacherDataView = ({
  onLogout,
}: {
  onLogout: () => void;
}) => {
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const fetchTeachers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiCall<TeachersDataResponse>("/api/admin/teachers-data", { onLogout });
      if (response && typeof response === "object" && "data" in response) {
        setTeachers(Array.isArray(response.data) ? response.data : []);
      } else if (Array.isArray(response)) {
        setTeachers(response);
      } else {
        setTeachers([]);
      }
    } catch (error) {
      toast({
        title: "Error memuat data guru",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await apiCall<Subject[]>("/api/admin/mapel", { onLogout });
      setSubjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load subjects", error);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
  }, [fetchTeachers, fetchSubjects]);

  // --- Stats ---
  const stats = useMemo(() => {
    const total = teachers.length;
    const aktif = teachers.filter((t) => t.status === "aktif").length;
    const nonaktif = total - aktif;
    return { total, aktif, nonaktif };
  }, [teachers]);

  // Filtered teachers by status (globalFilter handles search)
  const filteredTeachers = useMemo(() => {
    if (statusFilter === "semua") return teachers;
    return teachers.filter((t) => t.status === statusFilter);
  }, [teachers, statusFilter]);

  // --- Handlers ---
  const openAddDialog = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (teacher: TeacherData) => {
    setFormData({
      nip: teacher.nip,
      nama: teacher.nama,
      email: teacher.email || "",
      mata_pelajaran: teacher.mata_pelajaran || "",
      alamat: teacher.alamat || "",
      telepon: teacher.telepon || "",
      jenis_kelamin: teacher.jenis_kelamin as GenderOption,
      status: teacher.status as "aktif" | "nonaktif",
    });
    setEditingId(teacher.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationRules = [
      { test: !formData.nip || !formData.nama, message: "NIP dan Nama wajib diisi!" },
      { test: !formData.jenis_kelamin, message: "Jenis kelamin wajib diisi!" },
      { test: formData.nip && !/^\d{10,20}$/.test(formData.nip), message: "NIP harus berupa angka 10-20 digit!" },
      { test: formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email), message: "Format email tidak valid!" },
      { test: formData.telepon?.trim() && !/^[\d+]{1,20}$/.test(formData.telepon.trim()), message: "Nomor telepon harus berupa angka, maksimal 20 karakter!" },
    ];

    for (const rule of validationRules) {
      if (rule.test) {
        toast({ title: "Error", description: rule.message, variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);

    try {
      const url = editingId ? `/api/admin/teachers-data/${editingId}` : "/api/admin/teachers-data";
      const method = editingId ? "PUT" : "POST";

      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout,
      });

      toast({ title: "Berhasil", description: editingId ? "Data guru berhasil diperbarui" : "Data guru berhasil ditambahkan" });
      setFormData(INITIAL_FORM_DATA);
      setEditingId(null);
      setDialogOpen(false);
      fetchTeachers();
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

  const handleToggleStatus = async (teacher: TeacherData) => {
    const newStatus = teacher.status === "aktif" ? "nonaktif" : "aktif";
    try {
      await apiCall(`/api/admin/teachers-data/${teacher.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...teacher,
          status: newStatus,
        }),
        onLogout,
      });
      toast({
        title: "Status diperbarui",
        description: `${teacher.nama} sekarang ${newStatus === "aktif" ? "Aktif" : "Non-aktif"}`,
      });
      fetchTeachers();
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
      await apiCall(`/api/admin/teachers-data/${id}`, {
        method: "DELETE",
        onLogout,
      });
      toast({ title: "Berhasil", description: `Data guru ${nama} berhasil dihapus` });
      fetchTeachers();
    } catch (error) {
      toast({
        title: "Error menghapus data guru",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  if (showImport) {
    return <ExcelImportView entityType="guru" entityName="Data Guru" onBack={() => { setShowImport(false); fetchTeachers(); }} />;
  }

  const statusFilterButtons: { label: string; value: StatusFilter; count: number }[] = [
    { label: "Semua", value: "semua", count: stats.total },
    { label: "Aktif", value: "aktif", count: stats.aktif },
    { label: "Non-aktif", value: "nonaktif", count: stats.nonaktif },
  ];

  // --- Column definitions ---
  const columns: ColumnDef<TeacherData>[] = [
    {
      accessorKey: "nip",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="NIP" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs max-w-[120px] truncate block" title={row.original.nip}>
          {row.original.nip}
        </span>
      ),
    },
    {
      accessorKey: "nama",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nama" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-xs max-w-[180px] truncate block" title={row.original.nama}>
          {row.original.nama}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[160px]" title={row.original.email ?? ""}>
          {row.original.email || "-"}
        </span>
      ),
    },
    {
      accessorKey: "mata_pelajaran",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mata Pelajaran" />
      ),
      cell: ({ row }) =>
        row.original.mata_pelajaran ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
            {row.original.mata_pelajaran}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      accessorKey: "jenis_kelamin",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="L/P" />
      ),
      cell: ({ row }) => (
        <span className="text-xs">{getGenderDisplay(row.original.jenis_kelamin)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(teacher)}
            className="cursor-pointer"
            title={`Klik untuk ${teacher.status === "aktif" ? "nonaktifkan" : "aktifkan"}`}
          >
            <Badge
              variant={teacher.status === "aktif" ? "default" : "secondary"}
              className={`text-xs transition-opacity hover:opacity-80 ${teacher.status === "aktif" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : ""}`}
            >
              {teacher.status === "aktif" ? "Aktif" : "Non-aktif"}
            </Badge>
          </button>
        );
      },
    },
    {
      id: "aksi",
      header: () => <div className="text-right text-xs">Aksi</div>,
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <div className="flex justify-end">
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Aksi</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => openEditDialog(teacher)}>
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Hapus
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apakah Anda yakin ingin menghapus data guru <strong>{teacher.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(teacher.id, teacher.nama)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Hapus
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
      enableSorting: false,
    },
  ];

  // Mobile row renderer
  const renderMobileRow = (teacher: TeacherData) => (
    <div key={teacher.id} className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{teacher.nama}</h3>
            <button
              type="button"
              onClick={() => handleToggleStatus(teacher)}
              className="cursor-pointer shrink-0"
            >
              <Badge
                variant={teacher.status === "aktif" ? "default" : "secondary"}
                className={`text-[10px] py-0 transition-opacity hover:opacity-80 ${teacher.status === "aktif" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : ""}`}
              >
                {teacher.status === "aktif" ? "Aktif" : "Non-aktif"}
              </Badge>
            </button>
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{teacher.nip}</p>
          {teacher.email && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{teacher.email}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Aksi</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => openEditDialog(teacher)}>
                  <Edit className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Hapus
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                <AlertDialogDescription>
                  Apakah Anda yakin ingin menghapus data guru <strong>{teacher.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(teacher.id, teacher.nama)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {teacher.mata_pelajaran && (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] mt-1">
          {teacher.mata_pelajaran}
        </Badge>
      )}
    </div>
  );

  // Toolbar: status filter buttons
  const toolbarContent = (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 flex-wrap">
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
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kelola Data Guru</h2>
          <p className="text-sm text-muted-foreground">Tambah, edit, dan hapus data guru</p>
        </div>
        <div className="flex flex-row gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Import Excel
          </Button>
          <Button onClick={openAddDialog} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Guru
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={`stat-skel-${i}`}>
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
                <GraduationCap className="h-4 w-4" />
                <span className="text-xs font-medium">Total Guru</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Guru Aktif</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.aktif}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Guru Non-aktif</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{stats.nonaktif}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredTeachers}
        searchPlaceholder="Cari nama, NIP, atau mata pelajaran..."
        isLoading={isLoading}
        emptyIcon={<GraduationCap className="w-12 h-12 text-muted-foreground/40" />}
        emptyTitle="Belum Ada Data"
        emptyDescription={
          statusFilter !== "semua"
            ? "Tidak ada guru yang cocok dengan filter"
            : "Belum ada data guru yang ditambahkan"
        }
        emptyAction={
          statusFilter === "semua" ? (
            <Button onClick={openAddDialog} size="sm" className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Tambah Guru Pertama
            </Button>
          ) : undefined
        }
        toolbarContent={toolbarContent}
        renderMobileRow={renderMobileRow}
        showColumnVisibility={false}
        pageSizeOptions={[15, 25, 50, 100]}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editingId ? "Edit Data Guru" : "Tambah Data Guru"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Perbarui informasi data guru" : "Tambahkan data guru baru ke sistem"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto px-6 pb-6">


            {/* Section 1: Data Pegawai */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Data Pegawai</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="nip" className="text-sm font-medium">
                    NIP / NUPTK <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <BadgeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nip"
                      value={formData.nip}
                      onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                      placeholder="Nomor Induk Pegawai"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="nama" className="text-sm font-medium">
                    Nama Lengkap <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nama"
                      value={formData.nama}
                      onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                      placeholder="Nama lengkap guru beserta gelar"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="jenis_kelamin" className="text-sm font-medium">
                    Jenis Kelamin <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <Users className="h-4 w-4" />
                    </div>
                    <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value as GenderOption })}>
                      <SelectTrigger className="pl-9">
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="status" className="text-sm font-medium">
                    Status Guru
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as "aktif" | "nonaktif" })}>
                      <SelectTrigger className="pl-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aktif">Aktif</SelectItem>
                        <SelectItem value="nonaktif">Non-aktif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Kontak & Akademik */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Kontak &amp; Akademik</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Email aktif"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="telepon" className="text-sm font-medium">
                    No. Telepon / WhatsApp
                  </Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="telepon"
                      value={formData.telepon}
                      onChange={(e) => setFormData({ ...formData, telepon: e.target.value })}
                      placeholder="Contoh: 081234567890"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="mata_pelajaran" className="text-sm font-medium">
                    Mata Pelajaran Utama
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <Select value={formData.mata_pelajaran} onValueChange={(value) => setFormData({ ...formData, mata_pelajaran: value })}>
                      <SelectTrigger className="pl-9">
                        <SelectValue placeholder="Pilih mata pelajaran pengampu..." />
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
                </div>
                <div className="col-span-2">
                  <Label htmlFor="alamat" className="text-sm font-medium">
                    Alamat Domisili
                  </Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="alamat"
                      value={formData.alamat}
                      onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                      placeholder="Alamat lengkap tempat tinggal"
                      rows={3}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-muted/50 mt-0">
              <div className="flex w-full sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto text-sm">
                  Batal
                </Button>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto text-sm">
                  {isSaving ? "Menyimpan..." : (
                    <>
                      {editingId ? <Edit className="mr-2 w-4 h-4" /> : <Plus className="mr-2 w-4 h-4" />}
                      {getSubmitButtonText(isSaving, !!editingId)} Data
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageTeacherDataView;
