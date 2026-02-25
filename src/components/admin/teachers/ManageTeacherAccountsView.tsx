import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import type { Subject, Teacher } from "@/types/dashboard";
import type { AccountStatusType, GenderType } from "@/types/admin";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import {
  BookOpen,
  Building,
  CheckCircle2,
  Edit,
  Eye,
  EyeOff,
  FileText,
  Key,
  Lock,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserCircle,
  Users,
  XCircle,
} from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/admin/ExcelImportView"));

interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
  stats?: {
    total: number;
    aktif: number;
    nonaktif: number;
  };
}

type SortField = "nip" | "nama" | "username" | "email" | "status";
type SortDirection = "asc" | "desc";
type StatusFilter = "semua" | "aktif" | "nonaktif";

const INITIAL_FORM_DATA = {
  nama: "",
  username: "",
  password: "",
  nip: "",
  mapel_id: "",
  email: "",
  no_telp: "",
  jenis_kelamin: "" as GenderType,
  alamat: "",
  status: "aktif" as AccountStatusType,
};

export const ManageTeacherAccountsView = ({
  onLogout,
}: {
  onLogout: () => void;
}) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nama: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Search & Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [sortField, setSortField] = useState<SortField>("nama");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activeItems, setActiveItems] = useState(0);
  const [inactiveItems, setInactiveItems] = useState(0);

  const [showImport, setShowImport] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize, statusFilter]);

  const fetchTeachers = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm || "",
      });

      if (statusFilter !== "semua") {
        queryParams.append("status", statusFilter);
      }

      queryParams.append("sort_by", sortField);
      queryParams.append("sort_dir", sortDirection);

      const response = await apiCall<Teacher[] | PaginatedResponse<Teacher>>(`/api/admin/guru?${queryParams.toString()}`, {
        onLogout,
        signal: controller.signal,
      });

      if (Array.isArray(response)) {
        setTeachers(response);
        setTotalItems(response.length);
        setTotalPages(1);
        setActiveItems(response.filter(t => t.status === 'aktif').length);
        setInactiveItems(response.filter(t => t.status === 'nonaktif').length);
      } else {
        setTeachers(response.data || []);
        setTotalItems(response.pagination?.total || 0);
        setTotalPages(response.pagination?.total_pages || 1);
        setActiveItems(response.stats?.aktif || 0);
        setInactiveItems(response.stats?.nonaktif || 0);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast({
        title: "Error memuat data guru",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [currentPage, pageSize, debouncedSearchTerm, statusFilter, sortField, sortDirection, onLogout]);

  const fetchSubjects = useCallback(async () => {
    try {
      const response = await apiCall<Subject[] | { data?: Subject[] }>("/api/admin/subjects", { onLogout });
      const subjectData = Array.isArray(response) ? response : response.data || [];
      setSubjects(subjectData);
    } catch (error) {
      console.error("Failed to load subjects", error);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // --- Handlers ---
  const openAddDialog = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingId(null);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEditDialog = (teacher: Teacher) => {
    setFormData({
      nama: teacher.nama || "",
      username: teacher.username || teacher.user_username || "",
      password: "",
      nip: teacher.nip || "",
      mapel_id: teacher.mapel_id ? String(teacher.mapel_id) : "",
      email: teacher.email || teacher.user_email || "",
      no_telp: teacher.no_telp || "",
      jenis_kelamin: (teacher.jenis_kelamin || "") as GenderType,
      alamat: teacher.alamat || teacher.address || teacher.user_alamat || teacher.user_address || "",
      status: (teacher.status || "aktif") as AccountStatusType,
    });
    setEditingId(teacher.id);
    setShowPassword(false);
    setDialogOpen(true);
  };


  const validateTeacherFormData = (data: typeof formData, isEditing: boolean): string | null => {
    if (!data.nama || !data.username || !data.nip) {
      return "Nama, username, dan NIP wajib diisi!";
    }
    if (!isEditing && !data.password) {
      return "Password wajib diisi untuk akun baru!";
    }
    if (!/^\d{10,20}$/.test(data.nip)) {
      return "NIP harus berupa angka 10-20 digit!";
    }
    if (!/^[a-zA-Z0-9._-]{4,32}$/.test(data.username)) {
      return "Username harus 4-32 karakter, hanya huruf, angka, titik, underscore, dan strip!";
    }
    if (data.email && data.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return "Format email tidak valid!";
    }
    if (data.no_telp && data.no_telp.trim() !== "" && !/^[\d+]{1,20}$/.test(data.no_telp.trim())) {
      return "Nomor telepon harus berupa angka dan plus, maksimal 20 karakter!";
    }
    if (data.mapel_id && data.mapel_id !== "" && (!Number.isInteger(Number(data.mapel_id)) || Number(data.mapel_id) <= 0)) {
      return "ID mata pelajaran harus berupa angka positif!";
    }
    return null;
  };

  const buildTeacherSubmitData = (data: typeof formData) => {
    const trimOrNull = (val: string | undefined | null) => (val && val.trim() !== "" ? val.trim() : null);
    return {
      nip: data.nip.trim(),
      nama: data.nama.trim(),
      username: data.username.trim(),
      password: data.password || undefined,
      email: trimOrNull(data.email),
      no_telp: trimOrNull(data.no_telp),
      jenis_kelamin: data.jenis_kelamin || null,
      alamat: trimOrNull(data.alamat),
      mapel_id: data.mapel_id && data.mapel_id !== "" ? Number.parseInt(data.mapel_id) : null,
      status: data.status,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateTeacherFormData(formData, !!editingId);
    if (validationError) {
      toast({ title: "Error", description: validationError, variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      const url = editingId ? `/api/admin/guru/${editingId}` : "/api/admin/guru";
      const method = editingId ? "PUT" : "POST";
      const submitData = buildTeacherSubmitData(formData);

      await apiCall(url, {
        method,
        body: JSON.stringify(submitData),
        onLogout,
      });

      toast({ title: "Berhasil", description: editingId ? "Akun guru berhasil diperbarui!" : "Akun guru berhasil ditambahkan!" });
      setFormData(INITIAL_FORM_DATA);
      setEditingId(null);
      setDialogOpen(false);
      fetchTeachers();
    } catch (error) {
      const errorDetails = typeof error === "object" && error !== null && "details" in error ? (error as { details?: unknown }).details : undefined;
      if (errorDetails) {
        let errorMessage = "Validation failed";
        if (Array.isArray(errorDetails)) {
          errorMessage = errorDetails.join(", ");
        } else if (typeof errorDetails === "object" && errorDetails !== null) {
          errorMessage = JSON.stringify(errorDetails);
        } else if (typeof errorDetails === "string" || typeof errorDetails === "number" || typeof errorDetails === "boolean") {
          errorMessage = String(errorDetails);
        }
        toast({ title: "Error Validasi", description: errorMessage, variant: "destructive" });
      } else {
        toast({ title: "Error", description: getErrorMessage(error) || "Gagal menyimpan data guru", variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (teacher: Teacher) => {
    const newStatus = teacher.status === "aktif" ? "nonaktif" : "aktif";
    try {
      await apiCall(`/api/admin/guru/${teacher.id}`, {
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
      await apiCall(`/api/admin/guru/${id}`, {
        method: "DELETE",
        onLogout,
      });
      toast({ title: "Berhasil", description: `Akun guru ${nama} berhasil dihapus` });
      fetchTeachers();
    } catch (error) {
      toast({ title: "Error menghapus akun guru", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const openDeleteDialog = (teacher: Teacher) => {
    setDeleteTarget({ id: teacher.id, nama: teacher.nama });
    setDeleteDialogOpen(true);
  };

  // --- DataTable column definitions ---
  const columns = useMemo<ColumnDef<Teacher>[]>(() => [
    {
      id: "no",
      header: () => <div className="text-xs font-medium">#</div>,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {(currentPage - 1) * pageSize + row.index + 1}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "nip",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="NIP" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs max-w-[120px] truncate block" title={row.original.nip}>
          {row.original.nip || "-"}
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
          {row.original.nama || "-"}
        </span>
      ),
    },
    {
      accessorKey: "username",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Username" />
      ),
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.username || row.original.user_username || "-"}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => {
        const email = row.original.email || row.original.user_email;
        return (
          <span className="text-xs max-w-[150px] truncate block" title={email}>
            {email || "-"}
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
      header: () => <div className="text-xs font-medium text-right">Aksi</div>,
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <span className="sr-only">Buka menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  onClick={() => openEditDialog(teacher)}
                  className="text-xs gap-2"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => openDeleteDialog(teacher)}
                  className="text-xs gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [currentPage, pageSize, sortField, sortDirection]);

  // Map state to DataTable props
  const tablePagination: PaginationState = {
    pageIndex: currentPage - 1,
    pageSize,
  };

  const tableSorting: SortingState = sortField
    ? [{ id: sortField, desc: sortDirection === "desc" }]
    : [];

  const handlePaginationChange = (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    const next = typeof updater === "function" ? updater(tablePagination) : updater;
    setCurrentPage(next.pageIndex + 1);
    setPageSize(next.pageSize);
  };

  const handleSortingChange = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    const next = typeof updater === "function" ? updater(tableSorting) : updater;
    if (next.length > 0) {
      setSortField(next[0].id as SortField);
      setSortDirection(next[0].desc ? "desc" : "asc");
    } else {
      setSortField("nama");
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Mobile row renderer
  const renderMobileRow = (teacher: Teacher) => (
    <div key={teacher.id} className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{teacher.nama || "-"}</h3>
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
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{teacher.nip || "-"}</p>
        </div>
        <div className="ml-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                onClick={() => openEditDialog(teacher)}
                className="text-xs gap-2"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => openDeleteDialog(teacher)}
                className="text-xs gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
        <div>
          <span className="text-muted-foreground">Username:</span>
          <p className="truncate">@{teacher.username || teacher.user_username || "-"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Email:</span>
          <p className="truncate">{teacher.email || teacher.user_email || "-"}</p>
        </div>
      </div>
    </div>
  );

  // Toolbar: status filter buttons
  const toolbarContent = (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
      <Button
        variant={statusFilter === "semua" ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter("semua")}
        className="text-xs h-9 px-3 whitespace-nowrap"
      >
        Semua
      </Button>
      <Button
        variant={statusFilter === "aktif" ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter("aktif")}
        className="text-xs h-9 px-3 whitespace-nowrap"
      >
        Aktif
      </Button>
      <Button
        variant={statusFilter === "nonaktif" ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter("nonaktif")}
        className="text-xs h-9 px-3 whitespace-nowrap"
      >
        Non-aktif
      </Button>
    </div>
  );

  if (showImport) {
    return <ExcelImportView entityType="teacher-account" entityName="Akun Guru" onBack={() => { setShowImport(false); fetchTeachers(); }} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kelola Akun Guru</h2>
          <p className="text-sm text-muted-foreground">Tambah, edit, dan hapus akun login guru</p>
        </div>
        <div className="flex flex-row gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Import Excel
          </Button>
          <Button onClick={openAddDialog} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading && totalItems === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
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
                <span className="text-xs font-medium">Total Akun</span>
              </div>
              <p className="text-2xl font-bold">{totalItems}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Guru Aktif</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeItems}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Guru Non-aktif</span>
              </div>
              <p className="text-2xl font-bold">{inactiveItems}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={teachers}
        isLoading={isLoading}
        manualPagination={true}
        manualSorting={true}
        pageCount={totalPages}
        pagination={tablePagination}
        onPaginationChange={handlePaginationChange}
        sorting={tableSorting}
        onSortingChange={handleSortingChange}
        totalItems={totalItems}
        globalFilter={searchTerm}
        onGlobalFilterChange={setSearchTerm}
        searchPlaceholder="Cari nama, username, atau NIP..."
        toolbarContent={toolbarContent}
        renderMobileRow={renderMobileRow}
        emptyIcon={<Users className="w-12 h-12 text-muted-foreground/40" />}
        emptyTitle="Belum Ada Data"
        emptyDescription={
          searchTerm || statusFilter !== "semua"
            ? "Tidak ada guru yang cocok dengan filter"
            : "Belum ada akun guru yang ditambahkan"
        }
        emptyAction={
          !searchTerm && statusFilter === "semua" ? (
            <Button onClick={openAddDialog} size="sm" className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Tambah Akun Pertama
            </Button>
          ) : undefined
        }
        pageSizeOptions={[15, 25, 50, 100]}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus akun guru <strong>{deleteTarget?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget.id, deleteTarget.nama);
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editingId ? "Edit Akun Guru" : "Tambah Akun Guru"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Perbarui informasi akun login guru" : "Tambahkan akun login guru baru ke sistem"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto px-6 pb-6">

            {/* Section 1: Data Pegawai */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Data Pegawai</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="nip" className="text-sm font-medium">
                    NIP <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nip"
                      value={formData.nip}
                      onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                      placeholder="Masukkan NIP"
                      className="pl-9"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="jenis_kelamin" className="text-sm font-medium">
                    Jenis Kelamin
                  </Label>
                  <Select value={formData.jenis_kelamin} onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value as GenderType })}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Pilih..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
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
                      placeholder="Masukkan nama lengkap"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Kontak & Akademik */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-5 w-5 text-primary" />
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
                      placeholder="Masukkan email"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="no_telp" className="text-sm font-medium">
                    No. Telepon
                  </Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="no_telp"
                      value={formData.no_telp}
                      onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })}
                      placeholder="Nomor telepon"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="mapel_id" className="text-sm font-medium">
                    Mata Pelajaran
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <Select value={formData.mapel_id} onValueChange={(value) => setFormData({ ...formData, mapel_id: value })}>
                      <SelectTrigger className="pl-9">
                        <SelectValue placeholder="Pilih mata pelajaran" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.filter((subject, index, self) => {
                          const key = `${subject.id}-${subject.nama_mapel}`;
                          return self.findIndex(s => `${s.id}-${s.nama_mapel}` === key) === index;
                        }).map((subject) => (
                          <SelectItem key={`subject-${subject.id}`} value={String(subject.id)}>
                            {subject.nama_mapel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Kredensial Login */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Kredensial Login</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="username" className="text-sm font-medium">
                    Username <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Masukkan username login"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password {editingId && <span className="text-muted-foreground text-[10px] ml-1 font-normal">(Opsional)</span>}
                    {!editingId && <span className="text-destructive">*</span>}
                  </Label>
                  <div className="relative mt-1.5">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingId ? "Kosongkan jika tetap" : "Masukkan password"}
                      required={!editingId}
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="status" className="text-sm font-medium">
                    Status Akun
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as AccountStatusType })}>
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
                      {editingId ? "Perbarui Akun" : "Simpan Akun"}
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

export default ManageTeacherAccountsView;
