
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; 
import { Search, Filter, Gavel } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall } from "@/utils/apiClient";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface BandingManagerProps {
  onLogout: () => void;
}

interface BandingRequest {
  id_banding: number;
  tanggal_pengajuan: string;
  tanggal_absen: string;
  nama_pengaju: string;
  nama_kelas: string;
  nama_mapel: string;
  status_asli: string;
  status_diajukan: string;
  alasan_banding: string;
  status_banding: 'pending' | 'disetujui' | 'ditolak';
  catatan_guru: string;
  diproses_oleh: string;
  jam_mulai: string;
  jam_selesai: string;
}

export const BandingAbsenManager: React.FC<BandingManagerProps> = ({ onLogout }) => {
  const [requests, setRequests] = useState<BandingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog State
  const [selectedRequest, setSelectedRequest] = useState<BandingRequest | null>(null);
  const [processNote, setProcessNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      // Use existing report endpoint but filter by status if needed
      // Ideally backend supports status filter: ?status=pending
      const url = `/api/admin/banding-absen?status=${filterStatus === 'all' ? '' : filterStatus}`;
      const data = await apiCall(url, { onLogout });
      setRequests(data as BandingRequest[]);
    } catch (error: any) {
      console.error('Failed to fetch banding requests:', error);
      toast({
        title: "Gagal memuat data",
        description: error.message || "Terjadi kesalahan",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, onLogout]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleProcess = async (status: 'disetujui' | 'ditolak') => {
    if (!selectedRequest) return;
    
    setIsProcessing(true);
    try {
      // Endpoint: PUT /api/banding-absen/:id/respond
      // Note: Endpoint expects { status_banding, catatan_guru }
      await apiCall(`/api/banding-absen/${selectedRequest.id_banding}/respond`, {
        method: 'PUT',
        body: JSON.stringify({
          status_banding: status,
          catatan_guru: processNote
        }),
        onLogout
      });

      toast({
        title: `Banding ${status === 'disetujui' ? 'Disetujui' : 'Ditolak'}`,
        description: `Permintaan banding siswa ${selectedRequest.nama_pengaju} telah diproses.`,
        variant: status === 'disetujui' ? "default" : "destructive"
      });

      setDialogOpen(false);
      fetchRequests(); // Refresh list
    } catch (error) {
      console.error('Failed to process banding:', error);
      toast({
        title: "Gagal memproses",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openProcessDialog = (req: BandingRequest) => {
    setSelectedRequest(req);
    setProcessNote('');
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'disetujui': return <Badge className="bg-green-100 text-green-800">Disetujui</Badge>;
      case 'ditolak': return <Badge className="bg-red-100 text-red-800">Ditolak</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800">Menunggu</Badge>;
    }
  };

  const filteredRequests = requests.filter(req => 
    req.nama_pengaju.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="w-6 h-6" />
            Manajemen Banding Absen
          </h2>
          <p className="text-gray-500">Tinjau dan putuskan pengajuan banding absensi siswa.</p>
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Cari Siswa / Kelas..."
              className="pl-9 w-[200px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="disetujui">Disetujui</SelectItem>
              <SelectItem value="ditolak">Ditolak</SelectItem>
              <SelectItem value="all">Semua</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Siswa</TableHead>
                <TableHead>Jadwal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Status Banding</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Tidak ada pengajuan banding ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => (
                  <TableRow key={req.id_banding}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm font-medium">{format(new Date(req.tanggal_pengajuan), 'dd MMM yyyy', { locale: id })}</div>
                      <div className="text-xs text-gray-500">{format(new Date(req.tanggal_pengajuan), 'HH:mm')}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{req.nama_pengaju}</div>
                      <div className="text-xs text-gray-500">{req.nama_kelas}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{req.nama_mapel}</div>
                      <div className="text-xs text-gray-500">{req.jam_mulai} - {req.jam_selesai}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-600 line-through">{req.status_asli}</span>
                        <span className="text-gray-400">-></span>
                        <span className="text-green-600 font-bold uppercase">{req.status_diajukan}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={req.alasan_banding}>
                      {req.alasan_banding}
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status_banding)}</TableCell>
                    <TableCell className="text-right">
                      {req.status_banding === 'pending' ? (
                        <Button size="sm" onClick={() => openProcessDialog(req)}>
                          Proses
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>
                          Selesai
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proses Banding Absen</DialogTitle>
            <DialogDescription>Tinjau dan proses pengajuan banding absensi siswa.</DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded-md">
                <div>
                  <span className="text-gray-500 block">Siswa</span>
                  <span className="font-medium">{selectedRequest.nama_pengaju}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Status Pengajuan</span>
                  <span className="font-medium uppercase">{selectedRequest.status_diajukan}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 block">Alasan</span>
                  <p className="mt-1 text-gray-700">{selectedRequest.alasan_banding}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Catatan Admin (Opsional)</label>
                <Textarea 
                  placeholder="Berikan alasan persetujuan atau penolakan..."
                  value={processNote}
                  onChange={(e) => setProcessNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700" 
                onClick={() => handleProcess('ditolak')}
                disabled={isProcessing}
              >
                Tolak
              </Button>
              <Button 
                className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700" 
                onClick={() => handleProcess('disetujui')}
                disabled={isProcessing}
              >
                Setujui
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

