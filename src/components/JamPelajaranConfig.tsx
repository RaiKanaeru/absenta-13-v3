/**
 * Jam Pelajaran Configuration Component
 * Admin UI for configuring time slots per class
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/config/api';
import { 
    Clock, 
    Save, 
    RotateCcw,
    Copy,
    Plus,
    Trash2,
    AlertTriangle
} from 'lucide-react';

interface JamPelajaran {
    id?: number;
    jam_ke: number;
    jam_mulai: string;
    jam_selesai: string;
    keterangan?: string | null;
}

interface Kelas {
    id_kelas: number;
    nama_kelas: string;
    tingkat?: string;
}

interface JamPelajaranByKelas {
    kelas_id: number;
    nama_kelas: string;
    tingkat: string;
    jam_pelajaran: JamPelajaran[];
}

const JamPelajaranConfig: React.FC = () => {
    const [kelasList, setKelasList] = useState<Kelas[]>([]);
    const [selectedKelasId, setSelectedKelasId] = useState<number | null>(null);
    const [jamPelajaran, setJamPelajaran] = useState<JamPelajaran[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [copyTargets, setCopyTargets] = useState<number[]>([]);
    const { toast } = useToast();

    // Fetch kelas list
    const fetchKelasList = useCallback(async () => {
        try {
            const response = await fetch(getApiUrl('/api/kelas/public'));
            const data = await response.json();
            setKelasList(data);
            if (data.length > 0 && !selectedKelasId) {
                setSelectedKelasId(data[0].id_kelas);
            }
        } catch (error) {
            console.error('Error fetching kelas:', error);
        }
    }, [selectedKelasId]);

    // Fetch jam pelajaran for selected kelas
    const fetchJamPelajaran = useCallback(async () => {
        if (!selectedKelasId) return;
        
        setLoading(true);
        try {
            const response = await fetch(getApiUrl(`/api/admin/jam-pelajaran/${selectedKelasId}`), {
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
                // Format time to HH:MM
                const formatted = result.data.map((jam: any) => ({
                    ...jam,
                    jam_mulai: formatTimeForInput(jam.jam_mulai),
                    jam_selesai: formatTimeForInput(jam.jam_selesai)
                }));
                setJamPelajaran(formatted);
            } else {
                // Load default if no data
                await loadDefaultJam();
            }
        } catch (error) {
            console.error('Error fetching jam pelajaran:', error);
            await loadDefaultJam();
        } finally {
            setLoading(false);
        }
    }, [selectedKelasId]);

    // Format time for input (HH:MM)
    const formatTimeForInput = (time: string): string => {
        if (!time) return '';
        const parts = time.split(':');
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    };

    // Load default jam pelajaran
    const loadDefaultJam = async () => {
        try {
            const response = await fetch(getApiUrl('/api/admin/jam-pelajaran/default'), {
                credentials: 'include'
            });
            const result = await response.json();
            if (result.success) {
                setJamPelajaran(result.data);
            }
        } catch (error) {
            console.error('Error loading default jam:', error);
        }
    };

    // Save jam pelajaran
    const handleSave = async () => {
        if (!selectedKelasId) return;
        
        setSaving(true);
        try {
            const response = await fetch(getApiUrl(`/api/admin/jam-pelajaran/${selectedKelasId}`), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jam_pelajaran: jamPelajaran })
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast({
                    title: 'Berhasil',
                    description: result.message,
                    variant: 'default'
                });
            } else {
                throw new Error(result.error || 'Gagal menyimpan');
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Gagal menyimpan jam pelajaran',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    // Reset to default
    const handleReset = async () => {
        await loadDefaultJam();
        toast({
            title: 'Reset',
            description: 'Jam pelajaran direset ke default',
            variant: 'default'
        });
    };

    // Copy to other classes
    const handleCopy = async () => {
        if (!selectedKelasId || copyTargets.length === 0) return;
        
        try {
            const response = await fetch(getApiUrl('/api/admin/jam-pelajaran/copy'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceKelasId: selectedKelasId,
                    targetKelasIds: copyTargets
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                toast({
                    title: 'Berhasil',
                    description: result.message,
                    variant: 'default'
                });
                setCopyDialogOpen(false);
                setCopyTargets([]);
            } else {
                throw new Error(result.error || 'Gagal menyalin');
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Gagal menyalin jam pelajaran',
                variant: 'destructive'
            });
        }
    };

    // Update jam pelajaran field
    const updateJam = (index: number, field: keyof JamPelajaran, value: string | number) => {
        const updated = [...jamPelajaran];
        (updated[index] as any)[field] = value;
        setJamPelajaran(updated);
    };

    // Add new jam
    const addJam = () => {
        const lastJam = jamPelajaran[jamPelajaran.length - 1];
        const newJamKe = lastJam ? lastJam.jam_ke + 1 : 1;
        setJamPelajaran([
            ...jamPelajaran,
            {
                jam_ke: newJamKe,
                jam_mulai: lastJam?.jam_selesai || '07:00',
                jam_selesai: '07:45',
                keterangan: null
            }
        ]);
    };

    // Remove jam
    const removeJam = (index: number) => {
        const updated = jamPelajaran.filter((_, i) => i !== index);
        setJamPelajaran(updated);
    };

    useEffect(() => {
        fetchKelasList();
    }, []);

    useEffect(() => {
        if (selectedKelasId) {
            fetchJamPelajaran();
        }
    }, [selectedKelasId]);

    const selectedKelas = kelasList.find(k => k.id_kelas === selectedKelasId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Clock className="h-6 w-6" />
                        Konfigurasi Jam Pelajaran
                    </h2>
                    <p className="text-gray-600">Atur jam pelajaran untuk setiap kelas</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Select 
                        value={selectedKelasId?.toString() || ''} 
                        onValueChange={(v) => setSelectedKelasId(parseInt(v))}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Pilih Kelas" />
                        </SelectTrigger>
                        <SelectContent>
                            {kelasList.map(kelas => (
                                <SelectItem key={kelas.id_kelas} value={kelas.id_kelas.toString()}>
                                    {kelas.nama_kelas}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {selectedKelas && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Badge variant="outline">{selectedKelas.tingkat || 'N/A'}</Badge>
                                    {selectedKelas.nama_kelas}
                                </CardTitle>
                                <CardDescription>
                                    {jamPelajaran.length} jam pelajaran terkonfigurasi
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleReset}>
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    Reset
                                </Button>
                                <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Copy className="h-4 w-4 mr-1" />
                                            Salin ke Kelas Lain
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Salin Jam Pelajaran</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <p className="text-sm text-gray-600">
                                                Salin konfigurasi jam dari <strong>{selectedKelas.nama_kelas}</strong> ke:
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {kelasList.filter(k => k.id_kelas !== selectedKelasId).map(kelas => (
                                                    <label key={kelas.id_kelas} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={copyTargets.includes(kelas.id_kelas)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setCopyTargets([...copyTargets, kelas.id_kelas]);
                                                                } else {
                                                                    setCopyTargets(copyTargets.filter(id => id !== kelas.id_kelas));
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-sm">{kelas.nama_kelas}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <Button 
                                                onClick={handleCopy} 
                                                disabled={copyTargets.length === 0}
                                                className="w-full"
                                            >
                                                Salin ke {copyTargets.length} Kelas
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <Button onClick={handleSave} disabled={saving}>
                                    <Save className="h-4 w-4 mr-1" />
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Header Row */}
                                <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 pb-2 border-b">
                                    <div className="col-span-1">Jam</div>
                                    <div className="col-span-3">Mulai</div>
                                    <div className="col-span-3">Selesai</div>
                                    <div className="col-span-4">Keterangan</div>
                                    <div className="col-span-1"></div>
                                </div>

                                {/* Jam Rows */}
                                {jamPelajaran.map((jam, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-1">
                                            <Badge variant="secondary" className="w-full justify-center">
                                                {jam.jam_ke}
                                            </Badge>
                                        </div>
                                        <div className="col-span-3">
                                            <Input
                                                type="time"
                                                value={jam.jam_mulai}
                                                onChange={(e) => updateJam(index, 'jam_mulai', e.target.value)}
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <Input
                                                type="time"
                                                value={jam.jam_selesai}
                                                onChange={(e) => updateJam(index, 'jam_selesai', e.target.value)}
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="col-span-4">
                                            <Input
                                                placeholder="Keterangan (opsional)"
                                                value={jam.keterangan || ''}
                                                onChange={(e) => updateJam(index, 'keterangan', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => removeJam(index)}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                {/* Add Button */}
                                <Button 
                                    variant="outline" 
                                    className="w-full mt-4"
                                    onClick={addJam}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Tambah Jam Pelajaran
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default JamPelajaranConfig;
