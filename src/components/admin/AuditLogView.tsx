import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { apiCall } from '@/utils/apiClient';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  ScrollText, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  X
} from 'lucide-react';

// --- Types ---

interface AuditLog {
  id: number;
  admin_id: number;
  admin_name: string;
  action: string;
  target: string;
  target_id: string | number | null;
  details: string | Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface FilterOptions {
  actions: string[];
  targets: string[];
}

interface AuditLogViewProps {
  onBack?: () => void;
  onLogout?: () => void;
}

// --- Helper Functions ---

const formatDate = (dateString: string) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(dateString));
  } catch (e) {
    return dateString;
  }
};

const getActionColor = (action: string) => {
  const upperAction = action.toUpperCase();
  if (upperAction.includes('CREATE') || upperAction.includes('ADD') || upperAction.includes('INSERT')) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  }
  if (upperAction.includes('UPDATE') || upperAction.includes('EDIT')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
  }
  if (upperAction.includes('DELETE') || upperAction.includes('REMOVE')) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
  }
  if (upperAction.includes('LOGIN')) {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
  }
  if (upperAction.includes('LOGOUT')) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';
  }
  return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
};

const parseDetails = (details: string | Record<string, unknown> | null) => {
  if (!details) return <span className="text-muted-foreground italic">-</span>;

  let parsed: Record<string, unknown> = {};
  
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details);
    } catch (e) {
      return <span className="text-xs font-mono truncate max-w-[200px] block" title={details}>{details}</span>;
    }
  } else {
    parsed = details;
  }

  if (Object.keys(parsed).length === 0) return <span className="text-muted-foreground italic">-</span>;

  return (
    <div className="flex flex-col gap-1 text-xs">
      {Object.entries(parsed).slice(0, 3).map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <span className="font-semibold text-muted-foreground">{key}:</span>
          <span className="truncate max-w-[150px]" title={String(value)}>
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
      {Object.keys(parsed).length > 3 && (
        <span className="text-muted-foreground text-[10px] italic">
          +{Object.keys(parsed).length - 3} lainnya...
        </span>
      )}
    </div>
  );
};

// --- Main Component ---

export default function AuditLogView({ onBack, onLogout }: AuditLogViewProps) {
  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ actions: [], targets: [] });
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter State
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [targetFilter, setTargetFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch Filter Options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await apiCall<{ data: FilterOptions }>('/api/admin/audit-logs/filters', { onLogout });
      if (response && response.data) {
        setFilterOptions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
      // Non-critical, don't show toast to avoid spamming if API fails silently
    }
  }, [onLogout]);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      
      if (search) params.append('search', search);
      if (actionFilter && actionFilter !== 'all') params.append('action', actionFilter);
      if (targetFilter && targetFilter !== 'all') params.append('target', targetFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiCall<{ data: { logs: AuditLog[], pagination: Pagination } }>(
        `/api/admin/audit-logs?${params.toString()}`, 
        { onLogout }
      );

      if (response && response.data) {
        setLogs(response.data.logs || []);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ 
        title: "Gagal memuat log aktivitas", 
        description: message, 
        variant: "destructive" 
      });
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, actionFilter, targetFilter, startDate, endDate, onLogout]);

  // Initial Load
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Fetch on dependency change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handlers
  const handleRefresh = () => {
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('all');
    setTargetFilter('all');
    setStartDate('');
    setEndDate('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" size="icon" onClick={onBack} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ScrollText className="w-6 h-6 text-primary" />
              Log Aktivitas Admin
            </h1>
            <p className="text-sm text-muted-foreground">
              Riwayat lengkap aktivitas dan perubahan data oleh admin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-9"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari admin, detail..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="pl-9"
              />
            </div>

            {/* Action Filter */}
            <Select 
              value={actionFilter} 
              onValueChange={(val) => {
                setActionFilter(val);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Semua Aksi" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Aksi</SelectItem>
                {filterOptions.actions.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Target Filter */}
            <Select 
              value={targetFilter} 
              onValueChange={(val) => {
                setTargetFilter(val);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Semua Target" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Target</SelectItem>
                {filterOptions.targets.map(target => (
                  <SelectItem key={target} value={target}>{target}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="text-xs"
                />
              </div>
              <span className="text-muted-foreground">-</span>
              <div className="relative flex-1">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Active Filters Summary & Reset */}
          {(search || actionFilter !== 'all' || targetFilter !== 'all' || startDate || endDate) && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                Menampilkan hasil filter
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleResetFilters}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3 mr-1" />
                Reset Filter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="overflow-hidden shadow-md border-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px] font-bold">Waktu (WIB)</TableHead>
                <TableHead className="w-[150px] font-bold">Admin</TableHead>
                <TableHead className="w-[120px] font-bold">Aksi</TableHead>
                <TableHead className="w-[120px] font-bold">Target</TableHead>
                <TableHead className="min-w-[250px] font-bold">Detail Perubahan</TableHead>
                <TableHead className="w-[120px] hidden md:table-cell font-bold">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map((val) => (
                  <TableRow key={`skeleton-row-${val}`}>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-6 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-64 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="hidden md:table-cell"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <div className="p-4 bg-muted rounded-full">
                        <Search className="w-8 h-8 opacity-20" />
                      </div>
                      <p className="font-medium">Tidak ada data log aktivitas ditemukan</p>
                      <p className="text-xs">Coba sesuaikan filter atau rentang waktu pencarian Anda</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="group hover:bg-muted/30 transition-colors border-b last:border-0">
                    <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      <div className="flex flex-col">
                        <span>{log.admin_name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">ID: #{log.admin_id || 'sys'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-md", getActionColor(log.action))}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium">
                        {log.target}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[400px]">
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                        {parseDetails(log.details)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] font-mono text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        {log.ip_address || '-'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-4 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Menampilkan <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> - <strong>{Math.min(pagination.page * pagination.limit, pagination.totalItems)}</strong> dari <strong>{pagination.totalItems}</strong> data
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs font-medium min-w-[3rem] text-center">
              Hal {pagination.page} / {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
