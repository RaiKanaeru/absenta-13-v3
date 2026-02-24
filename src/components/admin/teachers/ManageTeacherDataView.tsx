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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Subject, TeacherData } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, Edit, FileText, GraduationCap, Plus, Search, Trash2, XCircle, UserCircle, Users, ShieldCheck, Mail, Phone, BookOpen, MapPin, Badge as BadgeIcon } from "lucide-react";

const ExcelImportView = React.lazy(() => import("@/components/admin/ExcelImportView"));

type SortField = "nip" | "nama" | "email" | "mata_pelajaran" | "jenis_kelamin" | "status";
type SortDirection = "asc" | "desc";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [sortField, setSortField] = useState<SortField>("nama");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // Pagination
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

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

  // --- Filtered & Sorted Teachers ---
  const filteredTeachers = useMemo(() => {
    let result = teachers;

    // Status filter
    if (statusFilter !== "semua") {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.nama?.toLowerCase().includes(term) ||
          t.nip?.toLowerCase().includes(term) ||
          t.mata_pelajaran?.toLowerCase().includes(term)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortField) {
        case "nip":
          valA = (a.nip || "").toLowerCase();
          valB = (b.nip || "").toLowerCase();
          break;
        case "nama":
          valA = (a.nama || "").toLowerCase();
          valB = (b.nama || "").toLowerCase();
          break;
        case "email":
          valA = (a.email || "").toLowerCase();
          valB = (b.email || "").toLowerCase();
          break;
        case "mata_pelajaran":
          valA = (a.mata_pelajaran || "").toLowerCase();
          valB = (b.mata_pelajaran || "").toLowerCase();
          break;
        case "jenis_kelamin":
          valA = (a.jenis_kelamin || "").toLowerCase();
          valB = (b.jenis_kelamin || "").toLowerCase();
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
  }, [teachers, searchTerm, statusFilter, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedTeachers = filteredTeachers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  const openEditSheet = (teacher: TeacherData) => {
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
    setSheetOpen(true);
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
      setSheetOpen(false);
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

  const editOrAddText = editingId ? "Perbarui" : "Tambah";
  const saveButtonText = isSaving ? "Menyimpan..." : editOrAddText;
  const isEmptyState = !isLoading && filteredTeachers.length === 0;

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
          <Button onClick={openAddSheet} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Guru
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={crypto.randomUUID()}>
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

      {/* Search + Filter */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Cari nama, NIP, atau mata pelajaran..."
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
                <div key={crypto.randomUUID()} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24 hidden sm:block" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-7 w-16 ml-auto" />
                </div>
              ))}
            </div>
          )}
          {isEmptyState && (
            <div className="text-center py-12">
              <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold text-muted-foreground mb-1">Belum Ada Data</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "semua"
                  ? "Tidak ada guru yang cocok dengan filter"
                  : "Belum ada data guru yang ditambahkan"}
              </p>
              {!searchTerm && statusFilter === "semua" && (
                <Button onClick={openAddSheet} size="sm" className="mt-4 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Tambah Guru Pertama
                </Button>
              )}
            </div>
          )}
          {!isLoading && filteredTeachers.length > 0 && (
            <>
              {/* Desktop Table - hidden on mobile */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">#</TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("nip")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          NIP {getSortIcon("nip")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("nama")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Nama {getSortIcon("nama")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("mata_pelajaran")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          Mata Pelajaran {getSortIcon("mata_pelajaran")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" onClick={() => handleSort("jenis_kelamin")} className="flex items-center text-xs font-medium hover:text-foreground transition-colors w-full text-left">
                          L/P {getSortIcon("jenis_kelamin")}
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
                    {pagedTeachers.map((teacher, index) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="text-muted-foreground text-xs">{startIndex + index + 1}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate" title={teacher.nip}>{teacher.nip}</TableCell>
                        <TableCell className="font-medium text-xs max-w-[180px] truncate" title={teacher.nama}>{teacher.nama}</TableCell>
                        <TableCell>
                          {teacher.mata_pelajaran ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                              {teacher.mata_pelajaran}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getGenderDisplay(teacher.jenis_kelamin)}
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditSheet(teacher)}
                              className="h-7 w-7 p-0"
                              title="Edit guru"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Hapus guru">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Apakah Anda yakin ingin menghapus data guru <strong>{teacher.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(teacher.id, teacher.nama)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                {pagedTeachers.map((teacher, index) => (
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
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSheet(teacher)}
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
                                Apakah Anda yakin ingin menghapus data guru <strong>{teacher.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(teacher.id, teacher.nama)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                ))}
              </div>

              {/* Pagination Footer */}
              <div className="p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
                <div className="text-xs text-muted-foreground">
                  Menampilkan {startIndex + 1}-{Math.min(startIndex + pageSize, filteredTeachers.length)} dari {filteredTeachers.length} guru
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
            <SheetTitle>{editingId ? "Edit Data Guru" : "Tambah Data Guru"}</SheetTitle>
            <SheetDescription>
              {editingId ? "Perbarui informasi data guru" : "Tambahkan data guru baru ke sistem"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-6 pb-6">
            
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
                <h3 className="font-semibold text-sm">Kontak & Akademik</h3>
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

            <SheetFooter className="pt-6 mt-6 border-t">
              <div className="flex w-full sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="w-full sm:w-auto text-sm">
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
export default ManageTeacherDataView;
