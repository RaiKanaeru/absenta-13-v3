import React, { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";

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
import type { Kelas, StudentData } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import { CheckCircle2, CreditCard, Edit, FileText, GraduationCap, MapPin, MoreHorizontal, Phone, Plus, ShieldCheck, Trash2, UserCircle, Users, XCircle } from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/admin/ExcelImportView"));

type StatusFilter = "semua" | "aktif" | "nonaktif";
type Gender = "L" | "P";

const INITIAL_FORM_DATA = {
  nis: "",
  nama: "",
  kelas_id: "",
  jenis_kelamin: "" as Gender | "",
  alamat: "",
  telepon_orangtua: "",
  nomor_telepon_siswa: "",
  status: "aktif" as "aktif" | "nonaktif",
  username: "",
  password: "",
  email: "",
  jabatan: "Siswa",
};

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

export const ManageStudentDataView = ({
  onLogout,
}: {
  onLogout: () => void;
}) => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const fetchStudentsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiCall<{ data: StudentData[]; pagination: unknown } | StudentData[]>("/api/admin/students-data", { onLogout });
      if (response && typeof response === "object" && "data" in response) {
        setStudents(Array.isArray(response.data) ? response.data : []);
      } else if (Array.isArray(response)) {
        setStudents(response);
      } else {
        setStudents([]);
      }
    } catch (error) {
      toast({
        title: "Error memuat data siswa",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall<Kelas[]>("/api/admin/kelas", { onLogout });
      setClasses(data);
    } catch (error) {
      console.error("Failed to load classes", error);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchStudentsData();
    fetchClasses();
  }, [fetchStudentsData, fetchClasses]);

  // --- Stats ---
  const stats = useMemo(() => {
    const total = students.length;
    const aktif = students.filter((s) => s.status === "aktif").length;
    const nonaktif = total - aktif;
    return { total, aktif, nonaktif };
  }, [students]);

  // --- Filtered students based on status filter ---
  const filteredStudents = useMemo(() => {
    if (statusFilter === "semua") return students;
    return students.filter((s) => s.status === statusFilter);
  }, [students, statusFilter]);

  // --- Handlers ---
  const openAddDialog = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (student: StudentData) => {
    setFormData({
      nis: student.nis,
      nama: student.nama,
      kelas_id: student.kelas_id?.toString() || "",
      jenis_kelamin: student.jenis_kelamin as Gender,
      alamat: student.alamat || "",
      telepon_orangtua: student.telepon_orangtua || "",
      nomor_telepon_siswa: student.nomor_telepon_siswa || "",
      status: student.status as "aktif" | "nonaktif",
      username: student.username || "",
      password: "",
      email: student.email || "",
      jabatan: student.jabatan || "Siswa",
    });
    setEditingId(student.id_siswa);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nis || !formData.nama) {
      toast({ title: "Error", description: "NIS dan Nama wajib diisi!", variant: "destructive" });
      return;
    }
    if (!/^\d{8,20}$/.test(formData.nis)) {
      toast({ title: "Error", description: "NIS harus berupa angka 8-20 digit!", variant: "destructive" });
      return;
    }
    if (formData.email && formData.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({ title: "Error", description: "Format email tidak valid!", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      const url = editingId ? `/api/admin/students-data/${editingId}` : "/api/admin/students-data";
      const method = editingId ? "PUT" : "POST";

      await apiCall(url, {
        method,
        body: JSON.stringify(formData),
        onLogout,
      });

      toast({ title: "Berhasil", description: editingId ? "Data siswa berhasil diperbarui" : "Data siswa berhasil ditambahkan" });
      setFormData(INITIAL_FORM_DATA);
      setEditingId(null);
      setDialogOpen(false);
      fetchStudentsData();
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

  const handleToggleStatus = async (student: StudentData) => {
    const newStatus = student.status === "aktif" ? "nonaktif" : "aktif";
    try {
      await apiCall(`/api/admin/students-data/${student.id_siswa}`, {
        method: "PUT",
        body: JSON.stringify({
          ...student,
          status: newStatus,
        }),
        onLogout,
      });
      toast({
        title: "Status diperbarui",
        description: `${student.nama} sekarang ${newStatus === "aktif" ? "Aktif" : "Non-aktif"}`,
      });
      fetchStudentsData();
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
      await apiCall(`/api/admin/students-data/${id}`, {
        method: "DELETE",
        onLogout,
      });
      toast({ title: "Berhasil", description: `Data siswa ${nama} berhasil dihapus` });
      fetchStudentsData();
    } catch (error) {
      toast({
        title: "Error menghapus data siswa",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  if (showImport) {
    return <ExcelImportView entityType="siswa" entityName="Data Siswa" onBack={() => { setShowImport(false); fetchStudentsData(); }} />;
  }

  const statusFilterButtons: { label: string; value: StatusFilter; count: number }[] = [
    { label: "Semua", value: "semua", count: stats.total },
    { label: "Aktif", value: "aktif", count: stats.aktif },
    { label: "Non-aktif", value: "nonaktif", count: stats.nonaktif },
  ];

  // --- Column Definitions ---
  const columns: ColumnDef<StudentData>[] = [
    {
      accessorKey: "nis",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="NIS" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs max-w-[120px] truncate block" title={row.getValue("nis")}>
          {row.getValue("nis")}
        </span>
      ),
    },
    {
      accessorKey: "nama",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nama" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-xs max-w-[180px] truncate block" title={row.getValue("nama")}>
          {row.getValue("nama")}
        </span>
      ),
    },
    {
      accessorKey: "nama_kelas",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Kelas" />
      ),
      cell: ({ row }) => {
        const namaKelas = row.getValue("nama_kelas") as string | undefined;
        return namaKelas ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
            {namaKelas}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        );
      },
    },
    {
      accessorKey: "jenis_kelamin",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="L/P" />
      ),
      cell: ({ row }) => (
        <span className="text-xs">{getGenderDisplay(row.getValue("jenis_kelamin"))}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const student = row.original;
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(student)}
            className="cursor-pointer"
            title={`Klik untuk ${student.status === "aktif" ? "nonaktifkan" : "aktifkan"}`}
          >
            <Badge
              variant={student.status === "aktif" ? "default" : "secondary"}
              className={`text-xs transition-opacity hover:opacity-80 ${student.status === "aktif" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : ""}`}
            >
              {student.status === "aktif" ? "Aktif" : "Non-aktif"}
            </Badge>
          </button>
        );
      },
    },
    {
      id: "aksi",
      header: () => <div className="text-right text-xs">Aksi</div>,
      cell: ({ row }) => {
        const student = row.original;
        return (
          <div className="flex justify-end">
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Buka menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => openEditDialog(student)} className="text-xs cursor-pointer">
                    <Edit className="h-3.5 w-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-xs text-destructive focus:text-destructive cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Hapus
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apakah Anda yakin ingin menghapus data siswa <strong>{student.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(student.id_siswa, student.nama)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Hapus
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];

  // --- Mobile Card Renderer ---
  const renderMobileRow = (student: StudentData) => (
    <div key={student.id_siswa} className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{student.nama}</h3>
            <button
              type="button"
              onClick={() => handleToggleStatus(student)}
              className="cursor-pointer shrink-0"
            >
              <Badge
                variant={student.status === "aktif" ? "default" : "secondary"}
                className={`text-[10px] py-0 transition-opacity hover:opacity-80 ${student.status === "aktif" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : ""}`}
              >
                {student.status === "aktif" ? "Aktif" : "Non-aktif"}
              </Badge>
            </button>
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{student.nis}</p>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Buka menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => openEditDialog(student)} className="text-xs cursor-pointer">
                  <Edit className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-xs text-destructive focus:text-destructive cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Hapus
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                <AlertDialogDescription>
                  Apakah Anda yakin ingin menghapus data siswa <strong>{student.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(student.id_siswa, student.nama)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {student.nama_kelas && (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] mt-1">
          {student.nama_kelas}
        </Badge>
      )}
    </div>
  );

  // --- Toolbar content: status filter buttons ---
  const toolbarContent = (
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
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kelola Data Siswa</h2>
          <p className="text-sm text-muted-foreground">Tambah, edit, dan hapus data siswa</p>
        </div>
        <div className="flex flex-row gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Import Excel
          </Button>
          <Button onClick={openAddDialog} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Siswa
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
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Total Siswa</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Siswa Aktif</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.aktif}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Siswa Non-aktif</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{stats.nonaktif}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredStudents}
        isLoading={isLoading}
        searchPlaceholder="Cari nama, NIS, atau kelas..."
        toolbarContent={toolbarContent}
        renderMobileRow={renderMobileRow}
        emptyIcon={<Users className="w-12 h-12 text-muted-foreground/40" />}
        emptyTitle="Belum Ada Data"
        emptyDescription={
          statusFilter !== "semua"
            ? "Tidak ada siswa yang cocok dengan filter"
            : "Belum ada data siswa yang ditambahkan"
        }
        emptyAction={
          statusFilter === "semua" ? (
            <Button onClick={openAddDialog} size="sm" className="mt-4 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Tambah Siswa Pertama
            </Button>
          ) : undefined
        }
        pageSizeOptions={[10, 15, 25, 50, 100]}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editingId ? "Edit Data Siswa" : "Tambah Data Siswa"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Perbarui informasi data siswa" : "Tambahkan data siswa baru ke sistem"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto px-6 pb-6">


            {/* Section 1: Data Akademik Siswa */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Data Akademik Siswa</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="nis" className="text-sm font-medium">
                    NIS <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nis"
                      value={formData.nis}
                      onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                      placeholder="Nomor Induk Siswa"
                      className="pl-9"
                      required
                      autoFocus
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
                      placeholder="Nama lengkap siswa"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="kelas_id" className="text-sm font-medium">
                    Kelas <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <Select value={formData.kelas_id} onValueChange={(value) => setFormData({ ...formData, kelas_id: value })}>
                      <SelectTrigger className="pl-9">
                        <SelectValue placeholder="Pilih kelas..." />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.filter(c => c.id).map((cls) => (
                          <SelectItem key={cls.id} value={cls.id.toString()}>
                            {cls.nama_kelas}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value as Gender })}>
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
              </div>
            </div>

            {/* Section 2: Kontak & Alamat */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Kontak & Alamat</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="telepon_orangtua" className="text-sm font-medium">
                    Telepon Ortu / Wali
                  </Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="telepon_orangtua"
                      value={formData.telepon_orangtua}
                      onChange={(e) => setFormData({ ...formData, telepon_orangtua: e.target.value })}
                      placeholder="Nomor HP Orang tua"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="nomor_telepon_siswa" className="text-sm font-medium">
                    Telepon Siswa
                  </Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nomor_telepon_siswa"
                      value={formData.nomor_telepon_siswa}
                      onChange={(e) => setFormData({ ...formData, nomor_telepon_siswa: e.target.value })}
                      placeholder="Nomor HP Siswa"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="alamat" className="text-sm font-medium">
                    Alamat Lengkap
                  </Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="alamat"
                      value={formData.alamat}
                      onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                      placeholder="Alamat lengkap tempat tinggal"
                      rows={2}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Status */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Status Siswa</h3>
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

            <DialogFooter className="px-6 py-4 border-t bg-muted/50 mt-0">
              <div className="flex w-full sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto text-sm">
                  Batal
                </Button>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto text-sm">
                  {isSaving ? "Menyimpan..." : (
                    <>
                      {editingId ? <Edit className="mr-2 w-4 h-4" /> : <Plus className="mr-2 w-4 h-4" />}
                      {getSubmitButtonText(isSaving, !!editingId)}
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

export default ManageStudentDataView;
