import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  BookOpen, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  Database, 
  Activity,
  ShieldCheck
} from "lucide-react";
import { apiCall, getErrorMessage } from '@/utils/apiClient';
import { formatTime24WithSeconds, formatDateOnly, getWIBTime } from "@/lib/time-utils";
import { LiveData } from '@/types/dashboard';
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LiveSummaryViewProps {
  onLogout: () => void;
}

interface SystemStatus {
  health: {
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    issues: string[];
  };
  redis: {
    connected: boolean;
  };
  database: {
    total: number;
    active: number;
  };
}

interface MonitoringDashboardResponse {
  health?: SystemStatus['health'];
  redis?: SystemStatus['redis'];
  metrics?: {
    database?: {
      connections?: SystemStatus['database'];
    };
  };
}

export const LiveSummaryView: React.FC<LiveSummaryViewProps> = ({ onLogout }) => {
  const [liveData, setLiveData] = useState<LiveData>({ ongoing_classes: [] });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(getWIBTime());

  const fetchLiveData = useCallback(async () => {
    try {
      const [liveRes, monitoringRes] = await Promise.all([
        apiCall('/api/admin/live-summary', { onLogout }),
        apiCall('/api/admin/monitoring-dashboard', { onLogout })
      ]);
      
      setLiveData(liveRes as LiveData);
      
      const mon = monitoringRes as MonitoringDashboardResponse;
      setSystemStatus({
        health: mon.health || { status: 'unknown', issues: [] },
        redis: mon.redis || { connected: false },
        database: mon.metrics?.database?.connections || { total: 0, active: 0 }
      });
    } catch (error) {
      toast({
        title: "Gagal memuat data",
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
      {/* System Health Status Bar */}
      {systemStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg border transition-all",
            systemStatus.health.status === 'healthy' ? "bg-emerald-500/5 border-emerald-500/20" : 
            systemStatus.health.status === 'warning' ? "bg-amber-500/5 border-amber-500/20" : "bg-rose-500/5 border-rose-500/20"
          )}>
            <div className={cn(
              "p-2 rounded-full",
              systemStatus.health.status === 'healthy' ? "bg-emerald-500/10 text-emerald-600" : 
              systemStatus.health.status === 'warning' ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600"
            )}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Status Sistem</p>
              <p className={cn(
                "text-sm font-bold capitalize",
                systemStatus.health.status === 'healthy' ? "text-emerald-600" : 
                systemStatus.health.status === 'warning' ? "text-amber-600" : "text-rose-600"
              )}>
                {systemStatus.health.status === 'healthy' ? 'Normal' : systemStatus.health.status}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-sky-500/20 bg-sky-500/5">
            <div className="p-2 rounded-full bg-sky-500/10 text-sky-600">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Database Pool</p>
              <p className="text-sm font-bold text-sky-600">
                {systemStatus.database.active}/{systemStatus.database.total} <span className="text-[10px] font-normal text-muted-foreground ml-1">Conns</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-600">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Redis Cache</p>
              <p className={cn(
                "text-sm font-bold",
                systemStatus.redis.connected ? "text-orange-600" : "text-rose-600"
              )}>
                {systemStatus.redis.connected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
            <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-600">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Auto Cleanup</p>
              <p className="text-sm font-bold text-indigo-600">Active</p>
            </div>
          </div>
        </div>
      )}

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
              {liveData.ongoing_classes.map((kelas) => {
                const classKey = kelas.id_kelas
                  ? `live-class-${kelas.id_kelas}`
                  : `live-class-${kelas.nama_kelas || kelas.kelas || 'unknown'}-${kelas.nama_mapel || kelas.mapel || 'subject'}-${kelas.jam_mulai || '00:00'}-${kelas.jam_selesai || '00:00'}`;

                return (
                <Card key={classKey} className="border-l-4 border-l-primary bg-card">
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveSummaryView;

