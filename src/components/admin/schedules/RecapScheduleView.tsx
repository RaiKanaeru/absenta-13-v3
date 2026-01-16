import React, { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiCall } from '@/utils/apiClient';
import { ArrowLeft, RefreshCw, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface JamSlot {
  jam_ke: number;
  jenis: 'pelajaran' | 'istirahat' | 'pembiasaan';
  label?: string;
  jam_mulai: string;
  jam_selesai: string;
}

interface CellData {
  id: number;
  mapel_id: number | null;
  guru_id: number | null;
  ruang_id: number | null;
  kode_mapel: string;
  nama_mapel: string;
  kode_guru: string;
  nama_guru: string;
  kode_ruang: string;
  jenis_aktivitas: string;
}

interface GridRow {
  kelas_id: number;
  nama_kelas: string;
  tingkat: string;
  cells: Record<number, CellData>;
}

interface MatrixData {
  hari: string;
  jam_slots: JamSlot[];
  rows: GridRow[];
}

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

export default function RecapScheduleView({ onBack }: { onBack: () => void }) {
  const [weekData, setWeekData] = useState<Record<string, MatrixData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const fetchFullWeek = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress(0);
    const newData: Record<string, MatrixData> = {};
    
    try {
      for (let i = 0; i < HARI_LIST.length; i++) {
        const hari = HARI_LIST[i];
        try {
          // Fetch sequentially to avoid overwhelming server or hitting limits (though parallel is usually fine)
          const response = await apiCall(`/api/admin/jadwal/matrix?hari=${hari}`, { method: 'GET' }) as { data?: MatrixData };
          if (response.data) {
            newData[hari] = response.data;
          }
        } catch (err) {
          console.error(`Failed to fetch ${hari}:`, err);
        }
        setLoadingProgress(prev => prev + 20);
      }
      setWeekData(newData);
    } catch (error) {
      console.error("Critical fetch error", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFullWeek();
  }, [fetchFullWeek]);

  const handlePrint = () => {
    window.print();
  };

  const getCellClass = (cell: CellData | undefined, type: 'mapel' | 'ruang' | 'guru') => {
    if (!cell) return 'bg-white';
    if (cell.jenis_aktivitas === 'upacara' || cell.jenis_aktivitas === 'pembiasaan') return 'bg-yellow-200 font-bold';
    switch(type) {
      case 'mapel': return 'bg-green-100 font-bold'; 
      case 'ruang': return 'bg-orange-100'; 
      case 'guru': return 'bg-blue-50'; 
      default: return '';
    }
  };

  // Get base rows from Monday (assuming class list is stable)
  const baseRows = weekData['Senin']?.rows || [];

  return (
    <div className="space-y-4 p-4 min-h-screen bg-gray-50 print:bg-white print:p-0">
      <div className="flex justify-between items-center print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
          </Button>
          <div className="flex flex-col">
          <h1 className="text-xl font-bold">Master Rekap Jadwal Mingguan</h1>
          <p className="text-sm text-gray-500">Menampilkan seluruh jadwal Senin - Jumat</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {isLoading && <Badge variant="secondary">Loading... {loadingProgress}%</Badge>}
          <Button variant="outline" onClick={fetchFullWeek} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Cetak
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto p-4 print:shadow-none print:border-none print:p-0">
        {isLoading && Object.keys(weekData).length === 0 ? (
          <div className="text-center p-12">Memuat data mingguan...</div>
        ) : (
          <div className="min-w-max">
             <table className="border-collapse border border-black text-xs text-center font-sans">
              <thead>
                {/* 1. Top Header: DAYS */}
                <tr className="bg-blue-800 text-white font-bold border border-black print:bg-slate-800 print:text-white">
                  <th className="border border-black p-2 w-24 bg-white text-black" rowSpan={3}>KELAS</th>
                  <th className="border border-black p-2 w-24 bg-white text-black" rowSpan={3}>ITEM</th>
                  {HARI_LIST.map(hari => (
                    <th key={hari} colSpan={(weekData[hari]?.jam_slots.length || 0)} className="border border-black p-1 text-base uppercase tracking-wider">
                      {hari}
                    </th>
                  ))}
                </tr>

                {/* 2. Sub Header: JAM KE */}
                <tr className="bg-yellow-300 font-bold border-b border-black text-[10px] print:bg-yellow-300">
                  {HARI_LIST.map(hari => 
                    weekData[hari]?.jam_slots.map((slot, idx) => (
                      <th key={`${hari}-${idx}`} className={`border border-black p-1 w-10 ${slot.jenis === 'istirahat' ? 'bg-gray-400' : ''}`}>
                         {slot.jenis === 'pembiasaan' ? '0' : (slot.jenis === 'istirahat' ? 'IST' : slot.jam_ke)}
                      </th>
                    ))
                  )}
                </tr>

                {/* 3. Sub Header: WAKTU */}
                <tr className="bg-white border-b-2 border-black text-[9px]">
                   {HARI_LIST.map(hari => 
                    weekData[hari]?.jam_slots.map((slot, idx) => (
                      <th key={`${hari}-${idx}`} className={`border border-black p-0.5 ${slot.jenis === 'istirahat' ? 'bg-gray-200' : ''}`}>
                         {slot.jam_mulai}<br/>{slot.jam_selesai}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {baseRows.map((baseRow) => (
                  <React.Fragment key={baseRow.kelas_id}>
                    {/* 1. MAPEL ROW */}
                    <tr className="border-t-2 border-black">
                      <td className="border-r-2 border-b-2 border-black p-1 font-bold bg-white align-middle text-sm" rowSpan={3}>
                        {baseRow.nama_kelas}
                      </td>
                      <td className="border border-black p-1 text-left px-2 bg-gray-50 font-bold text-[10px] h-8 align-middle">MAPEL</td>
                      
                      {HARI_LIST.map(hari => {
                        const dayData = weekData[hari];
                        // Find matching row for this day
                        const dayRow = dayData?.rows.find(r => r.kelas_id === baseRow.kelas_id);
                        
                         return dayData?.jam_slots.map((slot) => {
                           const cell = dayRow?.cells[slot.jam_ke];
                           
                           if (slot.jenis === 'istirahat') {
                             return (
                               <td key={`${hari}-${slot.jam_ke}`} rowSpan={3} className="border border-black bg-yellow-400 p-0 font-bold align-middle w-6">
                                  <div className="writing-vertical transform rotate-180 m-auto text-[9px] tracking-widest h-16 flex items-center justify-center">
                                    {slot.label?.includes('Dzuhur') ? 'DZUHUR' : 'ISTIRAHAT'}
                                  </div>
                               </td>
                             );
                           }

                           return (
                             <td key={`${hari}-${slot.jam_ke}`} className={`border border-black p-0.5 text-[10px] font-bold align-middle ${getCellClass(cell, 'mapel')}`}>
                               {cell?.jenis_aktivitas === 'upacara' ? 'UPCR' : (cell?.kode_mapel || '')}
                             </td>
                           );
                         });
                      })}
                    </tr>

                    {/* 2. RUANG ROW */}
                    <tr>
                      <td className="border border-black p-1 text-left px-2 bg-gray-50 font-semibold text-[10px] h-6 align-middle">RUANG</td>
                      {HARI_LIST.map(hari => {
                         const dayData = weekData[hari];
                         const dayRow = dayData?.rows.find(r => r.kelas_id === baseRow.kelas_id);
                         
                         return dayData?.jam_slots.map((slot) => {
                           if (slot.jenis === 'istirahat') return null;
                           const cell = dayRow?.cells[slot.jam_ke];
                           return (
                            <td key={`${hari}-${slot.jam_ke}`} className={`border border-black p-0.5 text-[9px] font-medium align-middle ${getCellClass(cell, 'ruang')}`}>
                               {cell?.kode_ruang || ''}
                            </td>
                           );
                         });
                      })}
                    </tr>

                    {/* 3. GURU ROW */}
                    <tr className="border-b-2 border-black">
                      <td className="border border-black p-1 text-left px-2 bg-gray-50 font-semibold text-[10px] h-6 align-middle">GURU</td>
                      {HARI_LIST.map(hari => {
                         const dayData = weekData[hari];
                         const dayRow = dayData?.rows.find(r => r.kelas_id === baseRow.kelas_id);
                         
                         return dayData?.jam_slots.map((slot) => {
                           if (slot.jenis === 'istirahat') return null;
                           const cell = dayRow?.cells[slot.jam_ke];
                           return (
                            <td key={`${hari}-${slot.jam_ke}`} className={`border border-black p-0.5 text-[9px] align-middle ${getCellClass(cell, 'guru')}`}>
                               {cell?.kode_guru || ''}
                            </td>
                           );
                         });
                      })}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
             </table>
          </div>
        )}
      </Card>
      
      <style>{`
        .writing-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
        @media print {
          @page { size: landscape; margin: 5mm; }
          .print:hidden { display: none; }
          .print:bg-yellow-300 { background-color: #fde047 !important; print-color-adjust: exact; }
          .print:bg-slate-800 { background-color: #1e293b !important; color: white !important; print-color-adjust: exact; }
          .bg-yellow-400 { background-color: #facc15 !important; print-color-adjust: exact; }
          .bg-gray-200 { background-color: #e5e7eb !important; print-color-adjust: exact; }
          .bg-gray-400 { background-color: #9ca3af !important; print-color-adjust: exact; }
          table { width: 100%; border-collapse: collapse; }
          td, th { font-size: 8px !important; }
        }
      `}</style>
    </div>
  );
}
