/**
 * ScheduleListView - Displays teacher's daily schedule
 * Extracted from TeacherDashboard_Modern.tsx
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { Schedule, STATUS_COLORS } from "./types";

interface ScheduleListViewProps {
  schedules: Schedule[];
  onSelectSchedule: (schedule: Schedule) => void;
  isLoading: boolean;
}

export const ScheduleListView = ({ schedules, onSelectSchedule, isLoading }: ScheduleListViewProps) => (
  <Card className="w-full">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
        <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
        Jadwal Hari Ini
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-16 sm:h-20 rounded"></div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Tidak ada jadwal hari ini</h3>
          <p className="text-sm sm:text-base text-gray-600">Selamat beristirahat!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            // Enhanced deduplication to prevent looping
            const uniqueSchedules = schedules.filter((schedule, index, self) => {
              const key = `${schedule.id}-${schedule.jam_mulai}-${schedule.jam_selesai}-${schedule.nama_mapel}`;
              return self.findIndex(s => 
                `${s.id}-${s.jam_mulai}-${s.jam_selesai}-${s.nama_mapel}` === key
              ) === index;
            });
            
            return uniqueSchedules.map((schedule) => {
              // Conditional rendering untuk jadwal yang tidak bisa diabsen
              if (!schedule.is_absenable) {
                return (
                  <div
                    key={schedule.id}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 bg-gray-50"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {schedule.jam_mulai} - {schedule.jam_selesai}
                          </Badge>
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            {schedule.jenis_aktivitas === 'upacara' ? 'Upacara' :
                             schedule.jenis_aktivitas === 'istirahat' ? 'Istirahat' :
                             schedule.jenis_aktivitas === 'kegiatan_khusus' ? 'Kegiatan Khusus' :
                             schedule.jenis_aktivitas === 'libur' ? 'Libur' :
                             schedule.jenis_aktivitas === 'ujian' ? 'Ujian' :
                             (schedule.jenis_aktivitas || 'Khusus')}
                          </Badge>
                        </div>
                        
                        <h4 className="font-medium text-gray-700 text-sm sm:text-base truncate">
                          {schedule.keterangan_khusus || schedule.nama_mapel}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{schedule.nama_kelas}</p>
                        
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                            Tidak perlu absen
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Jadwal normal yang bisa diabsen
              return (
                <div
                  key={schedule.id}
                  className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelectSchedule(schedule)}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {schedule.jam_mulai} - {schedule.jam_selesai}
                        </Badge>
                        <Badge className={`${STATUS_COLORS[schedule.status || 'upcoming']} text-xs whitespace-nowrap`}>
                          {schedule.status === 'current' ? 'Sedang Berlangsung' : 
                           schedule.status === 'completed' ? 'Selesai' : 'Akan Datang'}
                        </Badge>
                      </div>
                      
                      <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">{schedule.nama_mapel}</h4>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{schedule.nama_kelas}</p>
                      
                      {schedule.is_multi_guru && schedule.other_teachers && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs mb-1">
                            🧑‍🏫 Team Teaching
                          </Badge>
                          <p className="text-xs text-gray-500 truncate">
                            {schedule.other_teachers.split('||').map(teacher => teacher.split(':')[1]).join(', ')}
                          </p>
                        </div>
                      )}
                      
                      {schedule.kode_ruang && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs">
                            {schedule.kode_ruang}
                            {schedule.nama_ruang && ` - ${schedule.nama_ruang}`}
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto text-xs sm:text-sm"
                      >
                        {schedule.status === 'current' ? 'Ambil Absensi' : 'Lihat Detail'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </CardContent>
  </Card>
);
