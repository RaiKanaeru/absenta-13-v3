/**
 * Monitoring Dashboard
 * Phase 6: Real-time monitoring, Alert system, Performance tracking
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { apiCall, getErrorMessage } from '@/utils/apiClient';
import {
    Activity,
    Server,
    Database,
    Zap,
    AlertTriangle,
    CheckCircle,
    RefreshCw,
    Clock,
    Bell,
    TrendingUp,
    Cpu,
    HardDrive,
    Timer,
    Wifi,
    ShieldAlert,
    BarChart3,
    Circle,
} from 'lucide-react';

interface SystemMetrics {
    system: {
        memory: { used: number; total: number; percentage: number };
        heap?: { used: number; total: number; percentage: number } | null;
        cpu: { usage: number; loadAverage: number[] };
        disk: { used: number; total: number; percentage: number; note?: string };
        uptime: number;
    };
    application: {
        requests: { total: number; active: number; completed: number; failed: number };
        responseTime: { average: number; min: number; max: number };
        errors: { count: number; lastError: Error | string | null };
    };
    database: {
        connections: { active: number; idle: number; total: number };
        queries: { total: number; slow: number; failed: number };
        responseTime: { average: number; min: number; max: number };
    };
}


interface SystemHealth {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    timestamp: string;
}

interface MonitoringAlert {
    id: string;
    type: string;
    severity: 'warning' | 'critical' | 'emergency';
    message: string;
    data: Record<string, unknown>;
    timestamp: string;
    resolved?: boolean;
    resolvedAt?: string;
    resolution?: string;
}

interface AlertStatistics {
    total: number;
    active: number;
    resolved: number;
    last24h: number;
    bySeverity: {
        warning: number;
        critical: number;
        emergency: number;
    };
    byType: { [key: string]: number };
}

interface MonitoringData {
    metrics: SystemMetrics;
    health: SystemHealth;
    alerts: MonitoringAlert[];
    alertStats: AlertStatistics;
    loadBalancer: Record<string, unknown> | null;
    queryOptimizer: Record<string, unknown> | null;
    redis: Record<string, unknown> | null;
    system: {
        uptime: number;
        nodeVersion: string;
        pid: number;
        platform: string;
        hostname: string;
        [key: string]: unknown;
    };
}

const MonitoringDashboard: React.FC = () => {
    const [data, setData] = useState<MonitoringData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(() => {
        // Load auto refresh state from localStorage, default to true
        const saved = localStorage.getItem('monitoringAutoRefresh');
        return saved === null ? true : JSON.parse(saved);
    });
    const [selectedAlert, setSelectedAlert] = useState<MonitoringAlert | null>(null);
    const { toast } = useToast();

    const fetchMonitoringData = React.useCallback(async () => {
        try {
            const result = await apiCall<{ data: MonitoringData }>('/api/admin/monitoring-dashboard');
            setData(result.data);
            setError(null);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    const resolveAlert = async (alertId: string) => {
        try {
            await apiCall(`/api/admin/resolve-alert/${alertId}`, {
                method: 'POST',
                body: JSON.stringify({ resolution: 'manual' })
            });
            await fetchMonitoringData();
        } catch (err) {
            toast({
                title: 'Error',
                description: getErrorMessage(err),
                variant: 'destructive'
            });
        }
    };

    useEffect(() => {
        fetchMonitoringData();

        if (autoRefresh) {
            const interval = setInterval(fetchMonitoringData, 5000); // Refresh every 5 seconds
            return () => clearInterval(interval);
        }
    }, [autoRefresh, fetchMonitoringData]);

    const formatBytes = (bytes: number) => {
        // Handle invalid or undefined values
        if (!bytes || bytes === 0 || Number.isNaN(bytes) || !Number.isFinite(bytes)) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const sizeIndex = Math.min(i, sizes.length - 1);

        return Number.parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
    };

    const formatUptime = (seconds: number) => {
        // Handle invalid or undefined values
        if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) return '0d 0h 0m';

        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    const getStatusColor = (status: string) => {
        const colorMap: Record<string, string> = {
            healthy: 'bg-green-500',
            warning: 'bg-yellow-500',
            critical: 'bg-red-500'
        };
        return colorMap[status] || 'bg-muted-foreground';
    };

    const getSeverityColor = (severity: string) => {
        const colorMap: Record<string, string> = {
            warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
            critical: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
            emergency: 'bg-destructive/15 text-destructive'
        };
        return colorMap[severity] || 'bg-muted text-muted-foreground';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <Activity className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">Loading monitoring data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Error loading monitoring data: {error}
                </AlertDescription>
            </Alert>
        );
    }

    if (!data) {
        return (
            <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription>
                    No monitoring data available
                </AlertDescription>
            </Alert>
        );
    }

    // Safe destructuring with properly typed fallback values
    const defaultMetrics: SystemMetrics = {
        system: { memory: { used: 0, total: 0, percentage: 0 }, heap: null, cpu: { usage: 0, loadAverage: [] }, disk: { used: 0, total: 0, percentage: 0 }, uptime: 0 },
        application: { requests: { total: 0, active: 0, completed: 0, failed: 0 }, responseTime: { average: 0, min: 0, max: 0 }, errors: { count: 0, lastError: null } },
        database: { connections: { active: 0, idle: 0, total: 0 }, queries: { total: 0, slow: 0, failed: 0 }, responseTime: { average: 0, min: 0, max: 0 } }
    };
    const metrics = data?.metrics ?? defaultMetrics;
    const health = data?.health || { status: 'unknown' as const, issues: [], timestamp: '' };
    const alerts = data?.alerts || [];
    const alertStats: AlertStatistics = data?.alertStats || { active: 0, total: 0, resolved: 0, last24h: 0, bySeverity: { warning: 0, critical: 0, emergency: 0 }, byType: {} };
    const loadBalancer = data?.loadBalancer || { totalRequests: 0, activeRequests: 0, completedRequests: 0, failedRequests: 0 };
    const system = data?.system || { uptime: 0, nodeVersion: '', pid: 0 };

    // Disk metrics for summary bar
    const diskUsed = metrics?.system?.disk?.used || 0;
    const diskTotal = metrics?.system?.disk?.total || 0;
    const diskPercentage = metrics?.system?.disk?.percentage || 0;

    const highUsageDisks = diskPercentage > 80 ? [{ fs: metrics?.system?.disk?.note || 'System Disk', usage: diskPercentage }] : [];

    return (
        <div className="space-y-5 sm:space-y-6 p-2 sm:p-0">
            {/* Header */}
            <DashboardHeader
                autoRefresh={autoRefresh}
                setAutoRefresh={setAutoRefresh}
                onRefresh={fetchMonitoringData}
            />

            {/* System Health Status */}
            <SystemHealthCard health={health} system={system} getStatusColor={getStatusColor} formatUptime={formatUptime} />

            {/* Key Metrics */}
            <KeyMetricsGrid metrics={metrics} formatBytes={formatBytes} />

            {/* Additional System Info Bar */}
            <SystemInfoBar system={system} diskPercentage={diskPercentage} diskUsed={diskUsed} diskTotal={diskTotal} highUsageDisks={highUsageDisks} formatBytes={formatBytes} />

            {/* Main Content Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted/60 rounded-xl">
                    <TabsTrigger
                        value="overview"
                        className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 transition-all"
                    >
                        <BarChart3 className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="alerts"
                        className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 transition-all"
                    >
                        <Bell className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                        Alerts
                        {alertStats.active > 0 && (
                            <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                                {alertStats.active}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger
                        value="performance"
                        className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 transition-all"
                    >
                        <TrendingUp className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                        Performance
                    </TabsTrigger>
                    <TabsTrigger
                        value="database"
                        className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 transition-all"
                    >
                        <Database className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                        Database
                    </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    <OverviewTabContent metrics={metrics} loadBalancer={loadBalancer} />
                </TabsContent>

                {/* Alerts Tab */}
                <TabsContent value="alerts" className="space-y-4">
                    <AlertsTabContent
                        alertStats={alertStats}
                        alerts={alerts}
                        getSeverityColor={getSeverityColor}
                        onViewDetails={setSelectedAlert}
                        onResolve={resolveAlert}
                    />
                </TabsContent>

                {/* Performance Tab */}
                <TabsContent value="performance" className="space-y-4">
                    <PerformanceTabContent metrics={metrics} />
                </TabsContent>

                {/* Database Tab */}
                <TabsContent value="database" className="space-y-4">
                    <DatabaseTabContent metrics={metrics} />
                </TabsContent>
            </Tabs>

            {/* Alert Details Dialog */}
            <AlertDetailsDialog
                alert={selectedAlert}
                onClose={() => setSelectedAlert(null)}
                onResolve={resolveAlert}
                getSeverityColor={getSeverityColor}
            />
        </div>
    );
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

const DashboardHeader = ({ autoRefresh, setAutoRefresh, onRefresh }) => (
    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                    <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">System Monitoring</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">Real-time system metrics &amp; alerting</p>
                </div>
            </div>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
            <Button
                variant="outline"
                size="sm"
                className={cn(
                    'w-full sm:w-auto transition-all',
                    autoRefresh && 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
                )}
                onClick={() => {
                    const newState = !autoRefresh;
                    setAutoRefresh(newState);
                    localStorage.setItem('monitoringAutoRefresh', JSON.stringify(newState));
                }}
            >
                <RefreshCw className={cn('h-4 w-4 mr-2', autoRefresh && 'animate-spin')} />
                <span className="hidden sm:inline">{autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}</span>
                <span className="sm:hidden">{autoRefresh ? 'Auto ON' : 'Auto OFF'}</span>
            </Button>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
            </Button>
        </div>
    </div>
);

const SystemHealthCard = ({ health, system, getStatusColor, formatUptime }) => {
    const status = health?.status || 'unknown';

    const statusConfig = {
        healthy: {
            badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
            card: 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-transparent',
            icon: <CheckCircle className="h-5 w-5 text-emerald-500" />,
            dot: 'bg-emerald-500 shadow-emerald-500/50',
            label: 'All Systems Operational',
        },
        warning: {
            badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
            card: 'border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent',
            icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
            dot: 'bg-amber-500 shadow-amber-500/50',
            label: 'Degraded Performance',
        },
        critical: {
            badge: 'bg-destructive/15 text-destructive border-destructive/30',
            card: 'border-destructive/30 bg-gradient-to-r from-destructive/5 to-transparent',
            icon: <ShieldAlert className="h-5 w-5 text-destructive" />,
            dot: 'bg-destructive shadow-destructive/50',
            label: 'Critical Issues Detected',
        },
    };

    const cfg = statusConfig[status as keyof typeof statusConfig] || {
        badge: 'bg-muted text-muted-foreground border-border',
        card: '',
        icon: <Circle className="h-5 w-5 text-muted-foreground" />,
        dot: getStatusColor(status),
        label: 'Status Unknown',
    };

    return (
        <Card className={cn('transition-all', cfg.card)}>
            <CardContent className="pt-5 pb-4">
                <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                            <div className={cn('w-2.5 h-2.5 rounded-full shadow-md', cfg.dot)} />
                            <div className={cn('absolute inset-0 rounded-full animate-ping opacity-60', cfg.dot)} />
                        </div>
                        <div className="flex items-center gap-2.5">
                            {cfg.icon}
                            <div>
                                <p className="font-semibold text-sm">{cfg.label}</p>
                                {health?.issues && health.issues.length > 0 && (
                                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                                        Issues: {health.issues.join(', ')}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Badge variant="outline" className={cn('ml-1 text-xs font-semibold', cfg.badge)}>
                            {status.toUpperCase()}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm pl-5 sm:pl-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs">Uptime</span>
                        </div>
                        <p className="font-mono font-semibold text-sm">{formatUptime((system.uptime as number) || 0)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// Shared progress bar with color-coded thresholds
const UsageProgress = ({ value }: { value: number }) => {
    const colorClass =
        value > 80
            ? '[&>div]:bg-red-500'
            : value > 60
              ? '[&>div]:bg-amber-500'
              : '[&>div]:bg-emerald-500';

    return (
        <Progress
            value={Math.min(Math.max(value, 0), 100)}
            className={cn('h-1.5 mt-3 bg-muted/60', colorClass)}
        />
    );
};

const KeyMetricsGrid = ({ metrics, formatBytes }) => {
    const memoryUsed = metrics?.system?.memory?.used || 0;
    const memoryTotal = metrics?.system?.memory?.total || 0;
    const memoryPercentage = metrics?.system?.memory?.percentage || 0;
    const heapUsed = metrics?.system?.heap?.used || 0;
    const heapTotal = metrics?.system?.heap?.total || 0;
    const heapPercentage = metrics?.system?.heap?.percentage || 0;
    const cpuUsage = metrics?.system?.cpu?.usage || 0;

    const getResponseTextClass = (value: number) => {
        if (value > 1000) return 'text-red-600';
        if (value > 500) return 'text-amber-600';
        return 'text-emerald-600';
    };

    const metricCardBase = 'transition-all hover:shadow-md hover:-translate-y-0.5';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Memory Card */}
            <Card className={cn(metricCardBase, 'border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System Memory</CardTitle>
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                        <Server className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="text-2xl font-bold tracking-tight">{formatBytes(memoryUsed)}</div>
                    <UsageProgress value={memoryPercentage} />
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">{memoryPercentage.toFixed(1)}% used</p>
                        <p className="text-xs text-muted-foreground">of {formatBytes(memoryTotal)}</p>
                    </div>
                    {heapUsed > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-dashed border-border/60">
                            <p className="text-xs text-muted-foreground">
                                Heap: <span className="font-medium text-foreground">{formatBytes(heapUsed)}</span> / {formatBytes(heapTotal)}
                                <span className="ml-1 text-muted-foreground/70">({heapPercentage.toFixed(1)}%)</span>
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* CPU Card */}
            <Card className={cn(metricCardBase, 'border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CPU Usage</CardTitle>
                    <div className="p-1.5 rounded-lg bg-violet-500/10">
                        <Cpu className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="text-2xl font-bold tracking-tight">{cpuUsage.toFixed(1)}%</div>
                    <UsageProgress value={cpuUsage} />
                    <p className="text-xs text-muted-foreground mt-2">
                        Load avg: <span className="font-mono font-medium text-foreground/80">
                            {(metrics?.system?.cpu?.loadAverage || [0, 0, 0]).map((l: number) => l?.toFixed(2) || '0').join(' · ')}
                        </span>
                    </p>
                </CardContent>
            </Card>

            {/* Total Requests Card */}
            <Card className={cn(metricCardBase, 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Requests</CardTitle>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <Activity className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="text-2xl font-bold tracking-tight">{(metrics?.application?.requests?.total || 0).toLocaleString()}</div>
                    <div className="flex items-center gap-2 mt-3">
                        <span className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5">
                            <CheckCircle className="h-3 w-3" />
                            {metrics?.application?.requests?.completed || 0}
                        </span>
                        <span className="flex items-center gap-1 text-xs bg-red-500/10 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            {metrics?.application?.requests?.failed || 0}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Active: <span className="font-medium text-foreground">{metrics?.application?.requests?.active || 0}</span>
                    </p>
                </CardContent>
            </Card>

            {/* Avg Response Card */}
            <Card className={cn(metricCardBase, 'border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Response</CardTitle>
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className={cn('text-2xl font-bold tracking-tight', getResponseTextClass(metrics?.application?.responseTime?.average || 0))}>
                        {(metrics?.application?.responseTime?.average || 0).toFixed(0)}ms
                    </div>
                    <div className="flex items-center justify-between mt-3">
                        <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Min</p>
                            <p className="text-xs font-mono font-medium">{(metrics?.application?.responseTime?.min || 0).toFixed(0)}ms</p>
                        </div>
                        <div className="h-6 w-px bg-border" />
                        <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max</p>
                            <p className="text-xs font-mono font-medium">{(metrics?.application?.responseTime?.max || 0).toFixed(0)}ms</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const SystemInfoBar = ({ system, diskPercentage, diskUsed, diskTotal, highUsageDisks, formatBytes }) => {
    const diskColorClass =
        diskPercentage > 80
            ? 'text-red-600 dark:text-red-400'
            : diskPercentage > 60
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-foreground';

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 border border-border/50">
            <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Node.js <span className="font-medium text-foreground">{system.nodeVersion || 'N/A'}</span>
            </span>
            <span className="hidden sm:block text-border">|</span>
            <span>PID <span className="font-mono font-medium text-foreground">{system.pid || 'N/A'}</span></span>
            <span className="hidden sm:block text-border">|</span>
            <span>Platform <span className="font-medium text-foreground">{system.platform || 'N/A'}</span></span>
            <span className="hidden sm:block text-border">|</span>
            <span>Host <span className="font-medium text-foreground">{system.hostname || 'N/A'}</span></span>
            {diskPercentage > 0 && (
                <>
                    <span className="hidden sm:block text-border">|</span>
                    <span className="flex items-center gap-1.5">
                        <HardDrive className="h-3 w-3" />
                        Disk{' '}
                        <span className={cn('font-semibold', diskColorClass)}>
                            {diskPercentage.toFixed(1)}%
                        </span>{' '}
                        ({formatBytes(diskUsed)} / {formatBytes(diskTotal)})
                        {highUsageDisks.length > 0 && (
                            <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4 bg-red-500/10 text-red-600 border-red-500/30">
                                High Usage
                            </Badge>
                        )}
                    </span>
                </>
            )}
        </div>
    );
};

const OverviewTabContent = ({ metrics, loadBalancer }) => {
    const isCircuitOpen = (loadBalancer?.circuitBreaker as { isOpen?: boolean })?.isOpen;
    const circuitClass = isCircuitOpen
        ? 'bg-destructive/15 text-destructive border-destructive/30'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    const circuitText = isCircuitOpen ? 'OPEN' : 'CLOSED';

    const activeConns = metrics?.database?.connections?.active || 0;
    const idleConns = metrics?.database?.connections?.idle || 0;
    const totalConns = metrics?.database?.connections?.total || 0;
    const connUsagePercent = totalConns > 0 ? (activeConns / totalConns) * 100 : 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Database Connections */}
            <Card className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                            <Database className="h-4 w-4 text-blue-500" />
                        </div>
                        Database Connections
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <Badge variant="outline" className="font-mono bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
                            {activeConns}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Idle</span>
                        <Badge variant="outline" className="font-mono bg-muted">
                            {idleConns}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-muted-foreground">Total Pool</span>
                        <Badge variant="outline" className="font-mono">
                            {totalConns}
                        </Badge>
                    </div>
                    {totalConns > 0 && (
                        <div className="pt-1">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground">Pool utilization</span>
                                <span className="text-xs font-medium">{connUsagePercent.toFixed(0)}%</span>
                            </div>
                            <UsageProgress value={connUsagePercent} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Load Balancer */}
            <Card className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <div className="p-1.5 rounded-lg bg-violet-500/10">
                            <Activity className="h-4 w-4 text-violet-500" />
                        </div>
                        Load Balancer
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Active Requests</span>
                        <Badge variant="outline" className="font-mono bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30">
                            {(loadBalancer?.activeRequests as number) ?? 0}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Queue Size</span>
                        <Badge variant="outline" className="font-mono">
                            {(loadBalancer?.totalQueueSize as number) ?? 0}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-muted-foreground">Circuit Breaker</span>
                        <Badge variant="outline" className={cn('font-semibold text-xs', circuitClass)}>
                            {circuitText}
                        </Badge>
                    </div>
                    <div className="pt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Wifi className="h-3 w-3" />
                        <span>{isCircuitOpen ? 'Circuit open — requests may be failing' : 'Circuit closed — operating normally'}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const AlertsTabContent = ({ alertStats, alerts, getSeverityColor, onViewDetails, onResolve }) => (
    <>
        {/* Alert Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="transition-all hover:shadow-md bg-gradient-to-br from-muted/30 to-transparent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</CardTitle>
                    <div className="p-1.5 rounded-lg bg-muted">
                        <Bell className="h-3 w-3 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="text-2xl font-bold tracking-tight">{alertStats?.total || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">All time</p>
                </CardContent>
            </Card>

            <Card className={cn(
                'transition-all hover:shadow-md',
                (alertStats?.active || 0) > 0
                    ? 'border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent'
                    : 'bg-gradient-to-br from-muted/30 to-transparent'
            )}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</CardTitle>
                    <div className={cn('p-1.5 rounded-lg', (alertStats?.active || 0) > 0 ? 'bg-red-500/10' : 'bg-muted')}>
                        <AlertTriangle className={cn('h-3 w-3', (alertStats?.active || 0) > 0 ? 'text-red-500' : 'text-muted-foreground')} />
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className={cn('text-2xl font-bold tracking-tight', (alertStats?.active || 0) > 0 && 'text-red-600 dark:text-red-400')}>
                        {alertStats?.active || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
                </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-md border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolved</CardTitle>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                        {alertStats?.resolved || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Fixed issues</p>
                </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-md bg-gradient-to-br from-muted/30 to-transparent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last 24h</CardTitle>
                    <div className="p-1.5 rounded-lg bg-muted">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="text-2xl font-bold tracking-tight">{alertStats?.last24h || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Recent activity</p>
                </CardContent>
            </Card>
        </div>

        {/* Alert List */}
        <Card className="transition-all hover:shadow-md">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                        <Bell className="h-4 w-4 text-amber-500" />
                    </div>
                    Active Alerts
                    {(alerts || []).length > 0 && (
                        <Badge variant="outline" className="ml-auto text-xs bg-destructive/10 text-destructive border-destructive/30">
                            {(alerts || []).length} unresolved
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {(alerts || []).length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle className="h-7 w-7 text-emerald-500" />
                        </div>
                        <p className="text-sm font-medium text-foreground">All clear!</p>
                        <p className="text-xs text-muted-foreground mt-1">No active alerts at this time.</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {(alerts || []).map((alert) => {
                            const severityBorderClass =
                                alert.severity === 'emergency'
                                    ? 'border-l-destructive'
                                    : alert.severity === 'critical'
                                      ? 'border-l-orange-500'
                                      : 'border-l-amber-500';
                            return (
                                <div
                                    key={alert.id}
                                    className={cn(
                                        'border rounded-xl p-3 sm:p-4 border-l-4 transition-all hover:shadow-sm bg-muted/20',
                                        severityBorderClass
                                    )}
                                >
                                    <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                                        <div className="flex flex-col space-y-1.5 sm:flex-row sm:items-start sm:space-y-0 sm:space-x-3 min-w-0 flex-1">
                                            <Badge className={cn('self-start text-xs font-semibold', getSeverityColor(alert.severity))}>
                                                {alert.severity.toUpperCase()}
                                            </Badge>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-semibold text-sm truncate">{alert.type}</h4>
                                                <p className="text-xs text-muted-foreground break-words mt-0.5">{alert.message}</p>
                                                <p className="text-[11px] text-muted-foreground/60 mt-1">
                                                    {new Date(alert.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-row gap-2 sm:flex-col sm:items-end sm:gap-1.5 pt-1 sm:pt-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-7 px-3"
                                                onClick={() => onViewDetails(alert)}
                                            >
                                                Details
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="text-xs h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                                onClick={() => onResolve(alert.id)}
                                            >
                                                Resolve
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    </>
);

const PerformanceTabContent = ({ metrics }) => {
    const avgResponse = metrics?.application?.responseTime?.average || 0;
    const responseColorClass =
        avgResponse > 1000 ? 'text-red-600 dark:text-red-400' : avgResponse > 500 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Response Time Card */}
            <Card className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                            <Timer className="h-4 w-4 text-blue-500" />
                        </div>
                        Response Time Metrics
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-3 rounded-xl bg-muted/40">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Average</p>
                            <p className={cn('text-xl font-bold font-mono', responseColorClass)}>
                                {avgResponse.toFixed(0)}<span className="text-xs font-normal ml-0.5">ms</span>
                            </p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-muted/40">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Min</p>
                            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                {(metrics?.application?.responseTime?.min || 0).toFixed(0)}<span className="text-xs font-normal ml-0.5">ms</span>
                            </p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-muted/40">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Max</p>
                            <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">
                                {(metrics?.application?.responseTime?.max || 0).toFixed(0)}<span className="text-xs font-normal ml-0.5">ms</span>
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2.5 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Avg response</span>
                            <span className="text-sm font-mono font-medium">{avgResponse.toFixed(2)}ms</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Error count</span>
                            <Badge variant="outline" className={cn(
                                'font-mono text-xs',
                                (metrics?.application?.errors?.count || 0) > 0
                                    ? 'bg-red-500/10 text-red-600 border-red-500/30'
                                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            )}>
                                {metrics?.application?.errors?.count || 0}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Database Performance Card */}
            <Card className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                            <Database className="h-4 w-4 text-emerald-500" />
                        </div>
                        Database Performance
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/30">
                        <span className="text-sm text-muted-foreground">Total Queries</span>
                        <Badge variant="outline" className="font-mono">
                            {metrics?.database?.queries?.total || 0}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <span className="text-sm text-muted-foreground">Slow Queries</span>
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono">
                            {metrics?.database?.queries?.slow || 0}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-red-500/5 border border-red-500/20">
                        <span className="text-sm text-muted-foreground">Failed Queries</span>
                        <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 font-mono">
                            {metrics?.database?.queries?.failed || 0}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/30 mt-1">
                        <span className="text-sm text-muted-foreground">Avg Query Time</span>
                        <span className="text-sm font-mono font-semibold">
                            {(metrics?.database?.responseTime?.average || 0).toFixed(2)}ms
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const DatabaseTabContent = ({ metrics }) => {
    const activeConns = metrics?.database?.connections?.active || 0;
    const idleConns = metrics?.database?.connections?.idle || 0;
    const totalConns = metrics?.database?.connections?.total || 0;
    const totalQueries = metrics?.database?.queries?.total || 0;
    const slowQueries = metrics?.database?.queries?.slow || 0;
    const failedQueries = metrics?.database?.queries?.failed || 0;
    const avgQueryTime = metrics?.database?.responseTime?.average || 0;
    const minQueryTime = metrics?.database?.responseTime?.min || 0;
    const maxQueryTime = metrics?.database?.responseTime?.max || 0;

    const connUsagePercent = totalConns > 0 ? (activeConns / totalConns) * 100 : 0;

    return (
        <div className="space-y-4">
            {/* Connection Pool Visualization */}
            <Card className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                            <Database className="h-4 w-4 text-blue-500" />
                        </div>
                        Connection Pool
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="text-center p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Active</p>
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeConns}</p>
                            <p className="text-xs text-muted-foreground mt-1">connections</p>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-muted/40 border border-border/50">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Idle</p>
                            <p className="text-3xl font-bold">{idleConns}</p>
                            <p className="text-xs text-muted-foreground mt-1">available</p>
                        </div>
                        <div className="text-center p-4 rounded-xl bg-muted/40 border border-border/50">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Pool</p>
                            <p className="text-3xl font-bold">{totalConns}</p>
                            <p className="text-xs text-muted-foreground mt-1">total</p>
                        </div>
                    </div>
                    {totalConns > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">Pool utilization</span>
                                <span className={cn(
                                    'text-xs font-semibold',
                                    connUsagePercent > 80 ? 'text-red-600' : connUsagePercent > 60 ? 'text-amber-600' : 'text-emerald-600'
                                )}>
                                    {connUsagePercent.toFixed(0)}%
                                </span>
                            </div>
                            <UsageProgress value={connUsagePercent} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Query Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Card className="transition-all hover:shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <div className="p-1.5 rounded-lg bg-violet-500/10">
                                <BarChart3 className="h-4 w-4 text-violet-500" />
                            </div>
                            Query Statistics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/30">
                            <span className="text-sm text-muted-foreground">Total Queries</span>
                            <span className="font-mono font-semibold text-sm">{totalQueries.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <span className="text-sm text-muted-foreground">Slow Queries</span>
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono">
                                {slowQueries}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-red-500/5 border border-red-500/20">
                            <span className="text-sm text-muted-foreground">Failed Queries</span>
                            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 font-mono">
                                {failedQueries}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="transition-all hover:shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </div>
                            Query Response Times
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="text-center p-3 rounded-xl bg-muted/40">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg</p>
                                <p className="text-lg font-bold font-mono">{avgQueryTime.toFixed(1)}<span className="text-xs font-normal">ms</span></p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-muted/40">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Min</p>
                                <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{minQueryTime.toFixed(1)}<span className="text-xs font-normal">ms</span></p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-muted/40">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Max</p>
                                <p className="text-lg font-bold font-mono text-red-600 dark:text-red-400">{maxQueryTime.toFixed(1)}<span className="text-xs font-normal">ms</span></p>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
                            {slowQueries > 0
                                ? `⚠ ${slowQueries} slow queries detected — review indexes`
                                : '✓ All queries performing within normal range'}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const AlertDetailsDialog = ({ alert, onClose, onResolve, getSeverityColor }) => {
    if (!alert) return null;

    const severityBorderClass =
        alert.severity === 'emergency'
            ? 'border-l-4 border-l-destructive'
            : alert.severity === 'critical'
              ? 'border-l-4 border-l-orange-500'
              : 'border-l-4 border-l-amber-500';

    return (
        <Dialog open={!!alert} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                        Alert Details
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className={cn('rounded-xl bg-muted/30 p-4', severityBorderClass)}>
                        <div className="flex items-start gap-3">
                            <Badge className={cn('text-xs font-semibold mt-0.5', getSeverityColor(alert.severity))}>
                                {alert.severity.toUpperCase()}
                            </Badge>
                            <div>
                                <h4 className="font-semibold text-sm sm:text-base">{alert.type}</h4>
                                <p className="text-xs sm:text-sm text-muted-foreground break-words mt-1">{alert.message}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-muted/30">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Timestamp</p>
                            <p className="text-xs sm:text-sm font-medium">{new Date(alert.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                            <p className="text-xs sm:text-sm font-medium">{alert.resolved ? 'Resolved' : 'Active'}</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Payload Data</p>
                        <pre className="text-xs bg-muted/60 border border-border/50 p-3 rounded-xl overflow-auto max-h-40 font-mono">
                            {JSON.stringify(alert.data, null, 2)}
                        </pre>
                    </div>

                    <div className="flex flex-col space-y-2 sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2 pt-2 border-t border-border/50">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                            Close
                        </Button>
                        <Button
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                            onClick={() => {
                                onResolve(alert.id);
                                onClose();
                            }}
                        >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Resolve Alert
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MonitoringDashboard;
