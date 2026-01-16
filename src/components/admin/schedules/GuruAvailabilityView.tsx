/**
 * GuruAvailabilityView - Manage ketersediaan guru per hari (MASTER GURU HARIAN)
 * 
 * Fitur:
 * - Tampilkan matrix guru × hari availability
 * - Bulk update via checkbox
 * - Filter by guru, status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Search, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { apiCall } from '@/utils/apiClient';
import { Teacher } from '@/types/dashboard';

interface GuruAvailabilityViewProps {
  onBack: () => void;
  onLogout: () => void;
}

interface AvailabilityRecord {
  guru_id: number;
  nama: string;
  nip: string;
  is_system_entity: boolean;
  availability: Record<string, boolean>;
  keterangan: Record<string, string>;
}

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const TAHUN_AJARAN = '2025/2026';

export function GuruAvailabilityView({ 
  onBack, 
  onLogout 
}: Readonly<GuruAvailabilityViewProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<AvailabilityRecord[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all teachers
      const teacherRes = await apiCall('/api/admin/guru', { method: 'GET', onLogout }) as { data?: Teacher[] };
      const teachers: Teacher[] = teacherRes.data || [];

      // Fetch existing availability data  
      const availRes = await apiCall('/api/admin/jadwal/guru-availability', { method: 'GET', onLogout }) as { 
        data?: Array<{ id_guru: number; hari: string; is_available: number; keterangan: string }> 
      };
      const availData = availRes.data || [];

      // Build availability map by guru_id and hari
      const availMap: Record<number, Record<string, { available: boolean; keterangan: string }>> = {};
      for (const item of availData) {
        if (!availMap[item.id_guru]) {
          availMap[item.id_guru] = {};
        }
        availMap[item.id_guru][item.hari] = {
          available: item.is_available === 1,
          keterangan: item.keterangan || ''
        };
      }

      // Convert to records
      const newRecords: AvailabilityRecord[] = teachers.map(teacher => ({
        guru_id: teacher.id,
        nama: teacher.nama,
        nip: teacher.nip,
        is_system_entity: false, // Will be set from API
        availability: HARI_LIST.reduce((acc, hari) => {
          acc[hari] = availMap[teacher.id]?.[hari]?.available ?? true; // Default: available
          return acc;
        }, {} as Record<string, boolean>),
        keterangan: HARI_LIST.reduce((acc, hari) => {
          acc[hari] = availMap[teacher.id]?.[hari]?.keterangan ?? '';
          return acc;
        }, {} as Record<string, string>)
      }));

      setRecords(newRecords);
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: "Error", description: "Gagal mengambil data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = (guruId: number, hari: string) => {
    setRecords(prev => prev.map(record => {
      if (record.guru_id === guruId) {
        return {
          ...record,
          availability: {
            ...record.availability,
            [hari]: !record.availability[hari]
          }
        };
      }
      return record;
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build payload with all changes
      const updates = [];
      for (const record of records) {
        for (const hari of HARI_LIST) {
          updates.push({
            guru_id: record.guru_id,
            hari,
            is_available: record.availability[hari],
            keterangan: record.keterangan[hari] || null,
            tahun_ajaran: TAHUN_AJARAN
          });
        }
      }

      await apiCall('/api/admin/jadwal/guru-availability/bulk', {
        method: 'POST',
        body: JSON.stringify({ updates }),
        onLogout
      });

      toast({ title: "Berhasil", description: "Data ketersediaan guru berhasil disimpan" });
      setHasChanges(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal menyimpan';
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter records
  const filteredRecords = records.filter(record =>
    record.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.nip.includes(searchTerm)
  );

  // Stats
  const totalGuru = records.length;
  const getUnavailableCount = (hari: string) => 
    records.filter(r => !r.availability[hari]).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ketersediaan Guru</h1>
            <p className="text-sm text-gray-600">Kelola hari mengajar guru (MASTER GURU HARIAN)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {HARI_LIST.map(hari => (
          <Card key={hari} className="p-3 text-center">
            <p className="text-sm font-medium text-gray-600">{hari}</p>
            <p className="text-lg font-bold">
              {totalGuru - getUnavailableCount(hari)}/{totalGuru}
            </p>
            <p className="text-xs text-gray-500">tersedia</p>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari nama guru atau NIP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="outline">Total: {filteredRecords.length} guru</Badge>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No</TableHead>
              <TableHead className="w-48">Nama Guru</TableHead>
              <TableHead className="w-32">NIP</TableHead>
              {HARI_LIST.map(hari => (
                <TableHead key={hari} className="text-center w-20">{hari}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Tidak ada data ditemukan
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record, idx) => (
                <TableRow key={record.guru_id}>
                  <TableCell className="text-center">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    {record.nama}
                    {record.is_system_entity && (
                      <Badge variant="secondary" className="ml-2 text-xs">System</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">{record.nip || '-'}</TableCell>
                  {HARI_LIST.map(hari => (
                    <TableCell key={hari} className="text-center">
                      <button
                        onClick={() => handleToggle(record.guru_id, hari)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        disabled={record.is_system_entity}
                      >
                        {record.availability[hari] ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                      </button>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Legend */}
      <div className="flex gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span>Tersedia (ADA)</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="w-4 h-4 text-red-400" />
          <span>Tidak Tersedia</span>
        </div>
      </div>
    </div>
  );
}

export default GuruAvailabilityView;
