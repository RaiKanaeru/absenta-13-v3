import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import type { Kelas, Student } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Edit, Eye, EyeOff, FileText, Plus, Search, Trash2, Users, UserCircle, Lock, ShieldCheck, CreditCard, GraduationCap, Key, Badge as BadgeIcon } from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/ExcelImportView"));

interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

interface ManageStudentsViewProps {
  onLogout: () => void;
}

type SortField = "nis" | "nama" | "nama_kelas" | "jabatan" | "status";
type SortDirection = "asc" | "desc";
type StatusFilter = "semua" | "aktif" | "nonaktif";

const INITIAL_FORM_DATA = {
  nama: "",
  nis: "",
  kelas_id: "",
  jenis_kelamin: "",
  telepon_orangtua: "",
  nomor_telepon_siswa: "",
  alamat: "",
  status: "aktif" as "aktif" | "nonaktif",
  username: "",
  password: "",
  email: "",
  jabatan: "Siswa",
  is_perwakilan: true,
};

export const ManageStudentsView = ({ onLogout }: ManageStudentsViewProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Kelas[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNis, setEditingNis] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  
  // Search & Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [sortField, setSortField] = useState<SortField>("nama");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  const [showImport, setShowImport] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize, statusFilter]);

  const fetchStudents = useCallback(async () => {
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

      // Append sort info (might be ignored by backend, fallback implemented locally)
      queryParams.append("sort_by", sortField);
      queryParams.append("sort_dir", sortDirection);

      const response = await apiCall<Student[] | PaginatedResponse<Student>>(
        `/api/admin/students?${queryParams.toString()}`,
        { onLogout, signal: controller.signal }
      );

      if (Array.isArray(response)) {
        setStudents(response);
        setTotalItems(response.length);
      } else {
        setStudents(response.data || []);
        setTotalItems(response.pagination?.total || 0);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast({ title: "Error memuat data siswa", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [currentPage, pageSize, debouncedSearchTerm, statusFilter, sortField, sortDirection, onLogout]);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await apiCall<Kelas[]>("/api/admin/classes", { onLogout });
      setClasses(data);
    } catch (error) {
      console.error("Failed to load classes", error);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Sort locally as fallback
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortField) {
        case "nis":
          valA = (a.nis || "").toLowerCase();
          valB = (b.nis || "").toLowerCase();
          break;
        case "nama":
          valA = (a.nama || "").toLowerCase();
          valB = (b.nama || "").toLowerCase();
          break;
        case "nama_kelas":
          valA = (a.nama_kelas || "").toLowerCase();
          valB = (b.nama_kelas || "").toLowerCase();
          break;
        case "jabatan":
          valA = (a.jabatan || "").toLowerCase();
          valB = (b.jabatan || "").toLowerCase();
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
  }, [students, sortField, sortDirection]);

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
    setEditingNis(null);
    setShowPassword(false);
    setFormErrors({});
    setSheetOpen(true);
  };

  const openEditSheet = (student: Student) => {
    const rawIsPerwakilan = (student as unknown as Record<string, unknown>).is_perwakilan;
    const isPerwakilan = typeof rawIsPerwakilan === "boolean" ? rawIsPerwakilan : Boolean(rawIsPerwakilan);
    setFormData({
      nama: student.nama,
      nis: student.nis || "",
      kelas_id: String(student.kelas_id || ""),
      jenis_kelamin: student.jenis_kelamin || "",
      telepon_orangtua: student.telepon_orangtua || "",
      nomor_telepon_siswa: student.nomor_telepon_siswa || "",
      alamat: student.alamat || "",
      status: (student.status || "aktif") as "aktif" | "nonaktif",
      username: student.username || "",
      password: "",
      email: student.email || "",
      jabatan: student.jabatan || "Siswa",
      is_perwakilan: isPerwakilan,
    });
    setEditingId(student.id);
    setEditingNis(student.nis || null);
    setShowPassword(false);
    setFormErrors({});
    setSheetOpen(true);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    type ValidationRule = { field: string; condition: boolean; message: string };
    const rules: ValidationRule[] = [
      { field: "nis", condition: !editingId && (!formData.nis || !/^\d{8,15}$/.test(formData.nis)), message: "NIS harus berupa angka 8-15 digit" },
      { field: "username", condition: !formData.username || !/^[a-z0-9._-]{4,30}$/.test(formData.username), message: "Username harus 4-30 karakter (huruf kecil, angka, dll)" },
      { field: "password", condition: !editingId && (!formData.password || formData.password.length < 6), message: "Password wajib diisi minimal 6 karakter" },
      { field: "email", condition: !!formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email), message: "Format email tidak valid" },
    ];

    rules.forEach((rule) => {
      if (rule.condition) errors[rule.field] = rule.message;
    });

    if (!editingId && !formData.is_perwakilan) {
      errors.is_perwakilan = "Akun siswa harus ditandai sebagai perwakilan";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildSubmitData = () => {
    const baseData = {
      username: formData.username,
      password: formData.password,
      email: formData.email,
      status: formData.status,
      is_perwakilan: Boolean(formData.is_perwakilan),
    };
    return editingId ? baseData : { ...baseData, nis: formData.nis };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({ title: "Error", description: "Mohon perbaiki error pada form", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      const url = editingId ? `/api/admin/students/${editingNis}` : "/api/admin/students";
      const method = editingId ? "PUT" : "POST";
      const submitData = buildSubmitData();

      await apiCall(url, {
        method,
        body: JSON.stringify(submitData),
        onLogout,
      });

      toast({ title: "Berhasil", description: editingId ? "Data siswa berhasil diperbarui!" : "Data siswa berhasil ditambahkan!" });
      setFormData(INITIAL_FORM_DATA);
      setFormErrors({});
      setEditingId(null);
      setEditingNis(null);
      setSheetOpen(false);
      fetchStudents();
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
        toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (student: Student) => {
    const newStatus = student.status === "aktif" ? "nonaktif" : "aktif";
    try {
      await apiCall(`/api/admin/students/${student.nis}`, {
        method: "PUT",
        body: JSON.stringify({
          status: newStatus,
        }),
        onLogout,
      });
      toast({
        title: "Status diperbarui",
        description: `${student.nama} sekarang ${newStatus === "aktif" ? "Aktif" : "Non-aktif"}`,
      });
      fetchStudents();
    } catch (error) {
      toast({
        title: "Gagal mengubah status",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number, nama: string, nis: string) => {
    try {
      await apiCall(`/api/admin/students/${nis}`, {
        method: "DELETE",
        onLogout,
      });
      toast({ title: "Berhasil", description: `Data siswa ${nama} (NIS: ${nis}) berhasil dihapus` });
      fetchStudents();
    } catch (error) {
      toast({ title: "Error menghapus data siswa", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  if (showImport) {
    return <ExcelImportView entityType="siswa" entityName="Data Siswa" onBack={() => { setShowImport(false); fetchStudents(); }} />;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kelola Akun Siswa</h2>
          <p className="text-sm text-muted-foreground">Tambah, edit, dan hapus akun login siswa perwakilan</p>
        </div>
        <div className="flex flex-row gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Import Excel
          </Button>
          <Button onClick={openAddSheet} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading && totalItems === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
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
        </div>
      )}

      {/* Search + Filter */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Cari berdasarkan nama atau NIS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Table / Data */}
      <Card>
        <CardContent className="p-0">
          {isLoading && students.length === 0 ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`row-skeleton-${i}`} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24 hidden sm:block" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-7 w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : !isLoading && students.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold text-muted-foreground mb-1">Belum Ada Data</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "semua"
                  ? "Tidak ada siswa yang sesuai dengan filter"
                  : "Belum ada akun siswa yang ditambahkan"}
              </p>
              {!searchTerm && statusFilter === "semua" && (
                <Button onClick={openAddSheet} size="sm" className="mt-4 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Tambah Akun Pertama
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table - hidden on mobile */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">
                        <button type="button" onClick={() => handleSort("nis")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          NIS {getSortIcon("nis")}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs">
                        <button type="button" onClick={() => handleSort("nama")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Nama {getSortIcon("nama")}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs">
                        <button type="button" onClick={() => handleSort("nama_kelas")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Kelas {getSortIcon("nama_kelas")}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs">
                        <button type="button" onClick={() => handleSort("jabatan")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Jabatan {getSortIcon("jabatan")}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs">
                        <button type="button" onClick={() => handleSort("status")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Status {getSortIcon("status")}
                        </button>
                      </TableHead>
                      <TableHead className="text-center text-xs">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="text-xs font-mono">{student.nis}</TableCell>
                        <TableCell className="font-medium text-xs">{student.nama}</TableCell>
                        <TableCell className="text-xs">{student.nama_kelas}</TableCell>
                        <TableCell className="text-xs">{student.jabatan || "Siswa"}</TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditSheet(student)}
                              className="h-7 w-7 p-0"
                              title="Edit akun siswa"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Hapus akun siswa">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus akun siswa <strong>{student.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(student.id, student.nama, student.nis)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

              {/* Mobile Card View */}
              <div className="lg:hidden divide-y">
                {sortedStudents.map((student) => (
                  <div key={student.id} className="p-4">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSheet(student)}
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
                                Apakah Anda yakin ingin menghapus akun siswa <strong>{student.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(student.id, student.nama, student.nis)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                      <div>
                        <span className="text-muted-foreground">Kelas:</span>
                        <p className="truncate">{student.nama_kelas || "-"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Jabatan:</span>
                        <p>{student.jabatan || "Siswa"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Footer */}
              <div className="p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
                <div className="text-xs text-muted-foreground">
                  Menampilkan {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, totalItems)} dari {totalItems} akun siswa
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-xs text-muted-foreground hidden sm:inline">Limit:</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-7 w-[65px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Sheet (Sidebar) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Akun Siswa" : "Tambah Akun Siswa"}</SheetTitle>
            <SheetDescription>
              {editingId ? "Perbarui informasi akun login siswa" : "Tambahkan akun login siswa baru ke sistem"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-6 pb-6">

            {/* Section 1: Data Siswa */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Data Akademik Siswa</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="nama" className="text-sm font-medium">
                    Nama Lengkap
                  </Label>
                  <div className="relative mt-1.5">
                    <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nama"
                      value={formData.nama}
                      onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                      placeholder="Diambil dari Data Siswa"
                      className="pl-9 bg-muted/50"
                      disabled
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="nis" className="text-sm font-medium">
                    NIS <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="nis"
                      value={formData.nis}
                      onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                      placeholder="NIS Siswa"
                      className={`pl-9 ${editingId ? "bg-muted/50" : ""} ${formErrors.nis ? "border-destructive" : ""}`}
                      disabled={!!editingId}
                    />
                  </div>
                  {formErrors.nis && <p className="text-xs text-destructive mt-1">{formErrors.nis}</p>}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="kelas_id" className="text-sm font-medium">
                    Kelas
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <Select value={formData.kelas_id} onValueChange={(value) => setFormData({ ...formData, kelas_id: value })}>
                      <SelectTrigger className="pl-9">
                        <SelectValue placeholder="Pilih kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.filter((c) => c.id).map((cls) => (
                          <SelectItem key={cls.id} value={String(cls.id)}>
                            {cls.nama_kelas} {cls.tingkat ? `(${cls.tingkat})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="jabatan" className="text-sm font-medium">
                    Jabatan (Struktur Kelas)
                  </Label>
                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground pointer-events-none">
                      <BadgeIcon className="h-4 w-4" />
                    </div>
                    <Select value={formData.jabatan} onValueChange={(value) => setFormData({ ...formData, jabatan: value })}>
                      <SelectTrigger className="pl-9">
                        <SelectValue placeholder="Pilih jabatan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Siswa">Siswa</SelectItem>
                        <SelectItem value="Ketua Kelas">Ketua Kelas</SelectItem>
                        <SelectItem value="Wakil Ketua">Wakil Ketua</SelectItem>
                        <SelectItem value="Sekretaris Kelas">Sekretaris Kelas</SelectItem>
                        <SelectItem value="Bendahara">Bendahara</SelectItem>
                        <SelectItem value="Anggota">Anggota</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center justify-start mt-6 pl-1">
                  <div className="flex items-center gap-2">
                    <input
                      id="is-perwakilan"
                      type="checkbox"
                      checked={formData.is_perwakilan}
                      onChange={(e) => setFormData({ ...formData, is_perwakilan: e.target.checked })}
                      className="rounded border-border text-emerald-600 focus:ring-ring w-4 h-4"
                    />
                    <Label htmlFor="is-perwakilan" className="text-sm font-medium cursor-pointer">
                      Tandai sebagai PIC / Perwakilan
                    </Label>
                  </div>
                  {formErrors.is_perwakilan && <p className="text-xs text-destructive mt-1 block">{formErrors.is_perwakilan}</p>}
                </div>
              </div>
            </div>

            {/* Section 2: Kredensial Login */}
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
                      className={`pl-9 ${formErrors.username ? "border-destructive" : ""}`}
                    />
                    {formErrors.username && <p className="text-xs text-destructive mt-1 absolute -bottom-5 left-0">{formErrors.username}</p>}
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
                      placeholder={editingId ? "Abaikan jika tetap" : "Password login"}
                      className={`pl-9 pr-10 ${formErrors.password ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {formErrors.password && <p className="text-xs text-destructive mt-1 absolute -bottom-5 left-0">{formErrors.password}</p>}
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

            <SheetFooter className="pt-6 mt-6 border-t">
              <div className="flex w-full sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="w-full sm:w-auto text-sm">
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
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};
