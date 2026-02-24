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
  DropdownMenuLabel,
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
import type { Room } from "@/types/dashboard";
import { apiCall, getErrorMessage } from "@/utils/apiClient";
import {
  CheckCircle2,
  Edit,
  FileText,
  Home,
  Info,
  MapPin,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

const ExcelImportView = React.lazy(
  () => import("@/components/admin/ExcelImportView"),
);

type StatusFilter = "semua" | "aktif" | "tidak_aktif";

const INITIAL_FORM_DATA = {
  kode_ruang: "",
  nama_ruang: "",
  lokasi: "",
  kapasitas: "",
  status: "aktif",
};

export const ManageRoomsView = ({
  onLogout,
}: {
  onLogout: () => void;
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [showImport, setShowImport] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiCall("/api/admin/ruang", { onLogout });
      setRooms(response as Room[]);
    } catch (error) {
      toast({
        title: "Error memuat data ruang",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // --- Stats ---
  const stats = useMemo(() => {
    const total = rooms.length;
    const aktif = rooms.filter((r) => r.status === "aktif").length;
    const tidakAktif = total - aktif;
    const totalKapasitas = rooms
      .filter((r) => r.status === "aktif")
      .reduce((sum, r) => sum + (r.kapasitas || 0), 0);
    return { total, aktif, tidakAktif, totalKapasitas };
  }, [rooms]);

  // --- Filtered data for DataTable ---
  const filteredRooms = useMemo(() => {
    if (statusFilter === "semua") return rooms;
    return rooms.filter((r) => r.status === statusFilter);
  }, [rooms, statusFilter]);

  // --- Handlers ---
  const openAddSheet = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEditSheet = (room: Room) => {
    setFormData({
      kode_ruang: room.kode_ruang,
      nama_ruang: room.nama_ruang || "",
      lokasi: room.lokasi || "",
      kapasitas: room.kapasitas?.toString() || "",
      status: room.status,
    });
    setEditingId(room.id);
    setSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.kode_ruang || formData.kode_ruang.trim() === "") {
      toast({
        title: "Error",
        description: "Kode ruang wajib diisi!",
        variant: "destructive",
      });
      return;
    }
    if (!/^[A-Za-z0-9-]{2,20}$/.test(formData.kode_ruang.trim())) {
      toast({
        title: "Error",
        description: "Kode ruang harus 2-20 karakter alfanumerik!",
        variant: "destructive",
      });
      return;
    }
    if (
      formData.kapasitas &&
      (Number.isNaN(Number.parseInt(formData.kapasitas)) ||
        Number.parseInt(formData.kapasitas) <= 0)
    ) {
      toast({
        title: "Error",
        description: "Kapasitas harus berupa angka positif!",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const body = {
        kode_ruang: formData.kode_ruang,
        nama_ruang: formData.nama_ruang,
        lokasi: formData.lokasi,
        kapasitas: formData.kapasitas
          ? Number.parseInt(formData.kapasitas)
          : null,
        status: formData.status,
      };

      if (editingId) {
        await apiCall(`/api/admin/ruang/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(body),
          onLogout,
        });
        toast({ title: "Berhasil", description: "Ruang berhasil diperbarui" });
      } else {
        await apiCall("/api/admin/ruang", {
          method: "POST",
          body: JSON.stringify(body),
          onLogout,
        });
        toast({ title: "Berhasil", description: "Ruang berhasil ditambahkan" });
      }

      setFormData(INITIAL_FORM_DATA);
      setEditingId(null);
      setSheetOpen(false);
      fetchRooms();
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

  const handleToggleStatus = async (room: Room) => {
    const newStatus = room.status === "aktif" ? "tidak_aktif" : "aktif";
    try {
      await apiCall(`/api/admin/ruang/${room.id}`, {
        method: "PUT",
        body: JSON.stringify({
          kode_ruang: room.kode_ruang,
          nama_ruang: room.nama_ruang,
          lokasi: room.lokasi,
          kapasitas: room.kapasitas,
          status: newStatus,
        }),
        onLogout,
      });
      toast({
        title: "Status diperbarui",
        description: `${room.kode_ruang} sekarang ${newStatus === "aktif" ? "Aktif" : "Tidak Aktif"}`,
      });
      fetchRooms();
    } catch (error) {
      toast({
        title: "Gagal mengubah status",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiCall(`/api/admin/ruang/${id}`, {
        method: "DELETE",
        onLogout,
      });
      toast({ title: "Berhasil", description: "Ruang berhasil dihapus" });
      fetchRooms();
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  // --- Column Definitions ---
  const columns: ColumnDef<Room>[] = useMemo(
    () => [
      {
        accessorKey: "kode_ruang",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Kode Ruang" />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-medium text-xs">
            {row.original.kode_ruang}
          </span>
        ),
      },
      {
        accessorKey: "nama_ruang",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nama Ruang" />
        ),
        cell: ({ row }) => (
          <span className="text-xs">{row.original.nama_ruang || "-"}</span>
        ),
      },
      {
        accessorKey: "lokasi",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Lokasi" />
        ),
        cell: ({ row }) => {
          const lokasi = row.original.lokasi;
          if (!lokasi) return <span className="text-xs">-</span>;
          return (
            <span className="flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              {lokasi}
            </span>
          );
        },
      },
      {
        accessorKey: "kapasitas",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Kapasitas" />
        ),
        cell: ({ row }) => {
          const kapasitas = row.original.kapasitas;
          if (!kapasitas) return <span className="text-xs">-</span>;
          return (
            <span className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3 text-muted-foreground shrink-0" />
              {kapasitas}
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
          const room = row.original;
          return (
            <button
              type="button"
              onClick={() => handleToggleStatus(room)}
              className="cursor-pointer"
              title={`Klik untuk ${room.status === "aktif" ? "nonaktifkan" : "aktifkan"}`}
            >
              <Badge
                variant={room.status === "aktif" ? "default" : "secondary"}
                className="text-xs transition-opacity hover:opacity-80"
              >
                {room.status === "aktif" ? "Aktif" : "Tidak Aktif"}
              </Badge>
            </button>
          );
        },
      },
      {
        id: "aksi",
        header: () => (
          <div className="text-right text-xs font-medium">Aksi</div>
        ),
        enableSorting: false,
        cell: ({ row }) => {
          const room = row.original;
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
                    <DropdownMenuLabel className="text-xs">
                      Aksi
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-xs cursor-pointer"
                      onClick={() => openEditSheet(room)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-xs cursor-pointer text-destructive focus:text-destructive"
                      >
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
                      Apakah Anda yakin ingin menghapus ruang{" "}
                      <strong>{room.kode_ruang}</strong>
                      {room.nama_ruang ? ` (${room.nama_ruang})` : ""}? Tindakan
                      ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(room.id)}
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
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // --- Status filter toolbar ---
  const statusFilterButtons: { label: string; value: StatusFilter; count: number }[] = [
    { label: "Semua", value: "semua", count: stats.total },
    { label: "Aktif", value: "aktif", count: stats.aktif },
    { label: "Tidak Aktif", value: "tidak_aktif", count: stats.tidakAktif },
  ];

  const toolbarContent = (
    <div className="flex items-center gap-1">
      {statusFilterButtons.map((btn) => (
        <Button
          key={btn.value}
          variant={statusFilter === btn.value ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(btn.value)}
          className="text-xs h-9 px-3"
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

  // --- Mobile card row renderer ---
  const renderMobileRow = (room: Room) => (
    <div key={room.id} className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-mono font-medium text-sm">{room.kode_ruang}</h3>
            <button
              type="button"
              onClick={() => handleToggleStatus(room)}
              className="cursor-pointer"
            >
              <Badge
                variant={room.status === "aktif" ? "default" : "secondary"}
                className="text-[10px] transition-opacity hover:opacity-80"
              >
                {room.status === "aktif" ? "Aktif" : "Tidak Aktif"}
              </Badge>
            </button>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {room.nama_ruang || "Tidak ada nama"}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  <span className="sr-only">Aksi</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel className="text-xs">Aksi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-xs cursor-pointer"
                  onClick={() => openEditSheet(room)}
                >
                  <Edit className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-xs cursor-pointer text-destructive focus:text-destructive">
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
                  Apakah Anda yakin ingin menghapus ruang{" "}
                  <strong>{room.kode_ruang}</strong>
                  {room.nama_ruang ? ` (${room.nama_ruang})` : ""}? Tindakan ini
                  tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(room.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {room.lokasi && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {room.lokasi}
          </span>
        )}
        {room.kapasitas && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3 shrink-0" />
            {room.kapasitas} orang
          </span>
        )}
      </div>
    </div>
  );

  if (showImport) {
    return (
      <ExcelImportView
        entityType="ruang"
        entityName="Ruang Kelas"
        onBack={() => {
          setShowImport(false);
          fetchRooms();
        }}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Kelola Ruang Kelas
          </h2>
          <p className="text-sm text-muted-foreground">
            Tambah, edit, dan hapus data ruang kelas
          </p>
        </div>
        <div className="flex flex-row gap-2">
          <Button
            onClick={() => setShowImport(true)}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Import Excel
          </Button>
          <Button onClick={openAddSheet} size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Tambah Ruang
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={`stat-skeleton-${String(i)}`}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Home className="h-4 w-4" />
                <span className="text-xs font-medium">Total Ruang</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Aktif</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {stats.aktif}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Tidak Aktif</span>
              </div>
              <p className="text-2xl font-bold text-red-500">
                {stats.tidakAktif}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Total Kapasitas</span>
              </div>
              <p className="text-2xl font-bold">
                {stats.totalKapasitas > 0 ? stats.totalKapasitas : "-"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredRooms}
        isLoading={isLoading}
        searchPlaceholder="Cari kode, nama, atau lokasi ruang..."
        searchColumn="kode_ruang"
        toolbarContent={toolbarContent}
        renderMobileRow={renderMobileRow}
        emptyIcon={<Home className="w-12 h-12 text-muted-foreground/40" />}
        emptyTitle="Belum Ada Data"
        emptyDescription={
          statusFilter !== "semua"
            ? "Tidak ada ruang yang cocok dengan filter"
            : "Belum ada ruang kelas yang ditambahkan"
        }
        emptyAction={
          statusFilter === "semua" ? (
            <Button onClick={openAddSheet} size="sm" className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Tambah Ruang Pertama
            </Button>
          ) : undefined
        }
        showColumnVisibility
      />

      {/* Add/Edit Sheet (Sidebar) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto w-[90vw]">
          <SheetHeader>
            <SheetTitle>
              {editingId ? "Edit Ruang Kelas" : "Tambah Ruang Kelas"}
            </SheetTitle>
            <SheetDescription>
              {editingId
                ? "Perbarui informasi ruang kelas"
                : "Tambahkan ruang kelas baru ke sistem"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-6 pb-6">
            {/* Section 1: Detail Ruang */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Detail Ruang</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="kode_ruang" className="text-sm font-medium">
                    Kode Ruang <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="kode_ruang"
                      value={formData.kode_ruang}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          kode_ruang: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Contoh: R-01"
                      className="pl-9"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    2-20 karakter alfanumerik
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="nama_ruang" className="text-sm font-medium">
                    Nama Ruang{" "}
                    <span className="text-muted-foreground font-normal">
                      (Opsional)
                    </span>
                  </Label>
                  <Input
                    id="nama_ruang"
                    value={formData.nama_ruang}
                    onChange={(e) =>
                      setFormData({ ...formData, nama_ruang: e.target.value })
                    }
                    placeholder="Lab Komputer"
                    className="mt-1.5"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="lokasi" className="text-sm font-medium">
                    Lokasi{" "}
                    <span className="text-muted-foreground font-normal">
                      (Opsional)
                    </span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="lokasi"
                      value={formData.lokasi}
                      onChange={(e) =>
                        setFormData({ ...formData, lokasi: e.target.value })
                      }
                      placeholder="Gedung A, Lantai 3"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Pengaturan Ruang */}
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Pengaturan Ruang</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="kapasitas" className="text-sm font-medium">
                    Kapasitas{" "}
                    <span className="text-muted-foreground font-normal">
                      (Siswa)
                    </span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="kapasitas"
                      type="number"
                      value={formData.kapasitas}
                      onChange={(e) =>
                        setFormData({ ...formData, kapasitas: e.target.value })
                      }
                      placeholder="30"
                      min="1"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="status" className="text-sm font-medium">
                    Status <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 pl-8 relative">
                      {formData.status === "aktif" ? (
                        <CheckCircle2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 z-10" />
                      ) : (
                        <XCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      )}
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
