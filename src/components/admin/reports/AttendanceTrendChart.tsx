import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiCall } from '@/utils/apiClient';
import { createSessionExpiredHandler } from '../utils/dashboardUtils';

type Period = '7days' | '30days' | '90days';

interface ChartDataPoint {
  date: string;
  hadir: number;
  tidakHadir: number;
  total?: number;
}

interface AttendanceTrendChartProps {
  onLogout: () => void;
}

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: '7days', label: '7 Hari' },
  { value: '30days', label: '30 Hari' },
  { value: '90days', label: '90 Hari' },
];

const chartConfig: ChartConfig = {
  hadir: {
    label: "Hadir",
    color: "hsl(160, 84%, 39%)",
  },
  tidakHadir: {
    label: "Tidak Hadir",
    color: "hsl(347, 77%, 60%)",
  },
};

function formatDateLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
}

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({ onLogout }) => {
  const [period, setPeriod] = useState<Period>('30days');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchChartData = useCallback(async (selectedPeriod: Period) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const data = await apiCall(`/api/dashboard/chart?period=${selectedPeriod}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        onLogout: createSessionExpiredHandler(onLogout, toast),
      });

      const formatted: ChartDataPoint[] = (Array.isArray(data) ? data : []).map((item: ChartDataPoint) => ({
        date: formatDateLabel(item.date),
        hadir: Number(item.hadir) || 0,
        tidakHadir: Number(item.tidakHadir) || 0,
      }));

      setChartData(formatted);
    } catch (err: unknown) {
      console.error('Error fetching chart data:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError('Gagal memuat data tren: ' + message);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchChartData(period);
  }, [period, fetchChartData]);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
  };

  return (
    <Card className="lg:col-span-3 border-0 shadow-sm">
      <CardHeader className="border-b bg-sky-500/10 dark:bg-sky-500/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-sky-700 dark:text-sky-400 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Tren Kehadiran
            </CardTitle>
            <CardDescription>Grafik kehadiran harian guru</CardDescription>
          </div>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={period === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange(opt.value)}
                className={period === opt.value
                  ? "bg-sky-600 hover:bg-sky-700 text-white"
                  : "bg-background"
                }
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto" />
              <p className="mt-2 text-sm text-muted-foreground">Memuat grafik...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchChartData(period)}
              className="mt-3"
            >
              Coba Lagi
            </Button>
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada data kehadiran untuk periode ini</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradientHadir" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-hadir)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-hadir)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradientTidakHadir" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-tidakHadir)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-tidakHadir)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                allowDecimals={false}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="hadir"
                type="monotone"
                fill="url(#gradientHadir)"
                stroke="var(--color-hadir)"
                strokeWidth={2}
              />
              <Area
                dataKey="tidakHadir"
                type="monotone"
                fill="url(#gradientTidakHadir)"
                stroke="var(--color-tidakHadir)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceTrendChart;
