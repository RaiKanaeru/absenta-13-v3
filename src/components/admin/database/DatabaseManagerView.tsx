import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Database, Play, FileText, FolderOpen, AlertTriangle, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { apiCall } from '@/utils/apiClient';
import { formatDateTime24 } from '@/lib/time-utils';
import { useToast } from '@/hooks/use-toast';

interface DatabaseFile {
    name: string;
    path: 'root' | 'seeders';
    size: number;
    created: string;
    modified: string;
    type: 'dump' | 'seeder';
}

export const DatabaseManagerView: React.FC = () => {
    const [files, setFiles] = useState<DatabaseFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [executing, setExecuting] = useState(false);
    const { toast } = useToast();

    const loadFiles = async () => {
        try {
            setLoading(true);
            const data = await apiCall<{ files: DatabaseFile[] }>('/api/admin/database-files');
            setFiles(data.files || []);
        } catch (error) {
            console.error('Error loading database files:', error);
            toast({
                title: "Error",
                description: "Gagal memuat daftar file database",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

    const handleExecute = async (file: DatabaseFile) => {
        const isSeeder = file.type === 'seeder';
        const confirmMessage = isSeeder 
            ? `Apakah Anda yakin ingin menjalankan seeder "${file.name}"? Ini akan menambahkan data dummy.`
            : `PERINGATAN: Apakah Anda yakin ingin me-restore "${file.name}"? TIndakan ini mungkin menimpa data yang ada!`;

        if (!confirm(confirmMessage)) return;

        try {
            setExecuting(true);
            const data = await apiCall<{ queries: number, message: string }>('/api/admin/database-files/execute', {
                method: 'POST',
                body: JSON.stringify({ filename: file.name, pathType: file.path })
            });

            toast({
                title: "Berhasil",
                description: `${data.message} (${data.queries} queries executed)`,
            });
        } catch (error) {
            console.error('Error executing file:', error);
            toast({
                title: "Gagal Eksekusi",
                description: error.message || "Terjadi kesalahan saat mengeksekusi file SQL",
                variant: "destructive"
            });
        } finally {
            setExecuting(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const rootFiles = files.filter(f => f.path === 'root');
    const seederFiles = files.filter(f => f.path === 'seeders');

    const FileTable = ({ data }: { data: DatabaseFile[] }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nama File</TableHead>
                    <TableHead>Ukuran</TableHead>
                    <TableHead>Terakhir Diubah</TableHead>
                    <TableHead>Aksi</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Tidak ada file ditemukan
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((file) => (
                        <TableRow key={file.name}>
                            <TableCell className="font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-500" />
                                {file.name}
                            </TableCell>
                            <TableCell>{formatSize(file.size)}</TableCell>
                            <TableCell>{formatDateTime24(file.modified)}</TableCell>
                            <TableCell>
                                <Button 
                                    size="sm" 
                                    variant={file.type === 'seeder' ? "secondary" : "destructive"}
                                    onClick={() => handleExecute(file)}
                                    disabled={executing}
                                >
                                    {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                                    {file.type === 'seeder' ? 'Run Seed' : 'Restore Dump'}
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Database File Manager</h2>
                    <p className="text-muted-foreground">Kelola dan eksekusi file SQL langsung dari server (Database Source Only)</p>
                </div>
                <Button variant="outline" onClick={loadFiles} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Alert variant="default" className="bg-blue-50 border-blue-200">
                <Database className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Direct Database Access</AlertTitle>
                <AlertDescription className="text-blue-700">
                    Fitur ini mengakses file di folder <code>database/</code> proyek. Hati-hati saat me-restore dump besar atau menimpa data produksi.
                </AlertDescription>
            </Alert>

            <Tabs defaultValue="dumps" className="w-full">
                <TabsList>
                    <TabsTrigger value="dumps">
                        <Database className="h-4 w-4 mr-2" />
                        Main Dumps
                        <Badge variant="secondary" className="ml-2">{rootFiles.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="seeders">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Seeders (Dummy Data)
                        <Badge variant="secondary" className="ml-2">{seederFiles.length}</Badge>
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="dumps" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Main Database Dumps</CardTitle>
                            <CardDescription>File SQL utama di root folder database (Structure & Master Data)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FileTable data={rootFiles} />
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="seeders" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dummy Data Seeders</CardTitle>
                            <CardDescription>Script SQL tambahan untuk mengisi data operasional (Testing)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FileTable data={seederFiles} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};
