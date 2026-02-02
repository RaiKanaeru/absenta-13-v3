import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { formatTime24WithSeconds, formatDateOnly, getWIBTime } from "@/lib/time-utils";
import { LiveData } from '@/types/dashboard';
import { toast } from "@/hooks/use-toast";

interface LiveSummaryViewProps {
  onLogout: () => void;
}

export const LiveSummaryView: React.FC<LiveSummaryViewProps> = ({ onLogout }) => {
  const [liveData, setLiveData] = useState<LiveData>({ ongoing_classes: [] });
  const [currentTime, setCurrentTime] = useState(getWIBTime());

  const fetchLiveData = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/live-summary', { onLogout });
      setLiveData(data as LiveData);
    } catch (error) {
      console.error('Error fetching live data:', error);
      // Only show toast on first error to avoid spam during polling
      toast({
        title: "Gagal memuat data live",
        description: getErrorMessage(error),
        variant: "destructive"
      });
    }
  }, [onLogout]);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getWIBTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Live Clock & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Waktu Sekarang</p>
                <p className="text-2xl font-bold">
                  {formatTime24WithSeconds(currentTime)}
                </p>
                <p className="text-blue-100 text-sm">
                  {formatDateOnly(currentTime)}
                </p>
              </div>
              <Clock className="w-12 h-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Kelas Berlangsung</p>
                <p className="text-3xl font-bold">{liveData.ongoing_classes.length}</p>
                <p className="text-green-100 text-sm">Kelas aktif saat ini</p>
              </div>
              <BookOpen className="w-12 h-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Tingkat Kehadiran</p>
                <p className="text-3xl font-bold">{liveData.overall_attendance_percentage || '0'}%</p>
                <p className="text-purple-100 text-sm">Kehadiran hari ini</p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ongoing Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Kelas yang Sedang Berlangsung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveData.ongoing_classes.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Tidak Ada Kelas Berlangsung</h3>
              <p className="text-muted-foreground">Saat ini tidak ada kelas yang sedang berlangsung.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveData.ongoing_classes.map((kelas, index) => (
                <Card key={`live-class-${kelas.id_kelas || index}`} className="border-l-4 border-l-primary bg-card">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {kelas.nama_kelas || kelas.kelas}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {kelas.jam_mulai} - {kelas.jam_selesai}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-foreground">
                        {kelas.nama_mapel || kelas.mapel}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Guru: {kelas.nama_guru || kelas.guru}
                      </p>
                      {kelas.absensi_diambil !== undefined && (
                        <div className="flex items-center gap-2">
                          {kelas.absensi_diambil > 0 ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Absensi Diambil
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Menunggu Absensi
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveSummaryView;

