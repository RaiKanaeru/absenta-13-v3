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
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading monitoring data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Error loading monitoring data: {error}
                </AlertDescription>
            </Alert>
        );
    }

    if (!data) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
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
        <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
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
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                    <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
                    <TabsTrigger value="alerts" className="text-xs sm:text-sm">Alerts</TabsTrigger>
                    <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
                    <TabsTrigger value="database" className="text-xs sm:text-sm">Database</TabsTrigger>
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
            <h2 className="text-xl sm:text-2xl font-bold truncate">System Monitoring Dashboard</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Real-time system monitoring and alerting</p>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
            <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                    const newState = !autoRefresh;
                    setAutoRefresh(newState);
                    localStorage.setItem('monitoringAutoRefresh', JSON.stringify(newState));
                }}
            >
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
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
    let badgeClass = 'bg-destructive/15 text-destructive';
    if (status === 'healthy') {
        badgeClass = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    } else if (status === 'warning') {
        badgeClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center text-base sm:text-lg">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} mr-3`}></div>
                    System Health Status
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <div className="min-w-0 flex-1">
                        <Badge variant="outline" className={badgeClass}>
                            {status.toUpperCase()}
                        </Badge>
                        {health?.issues && health.issues.length > 0 && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2 break-words">Issues: {health.issues.join(', ')}</p>
                        )}
                    </div>
                    <div className="text-left sm:text-right">
                        <p className="text-xs sm:text-sm text-muted-foreground">System Uptime</p>
                        <p className="font-semibold text-sm sm:text-base">{formatUptime((system.uptime as number) || 0)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
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

    const getUsageProgressClass = (value: number) => {
        if (value > 80) return 'mt-2 [&>div]:bg-red-500';
        if (value > 60) return 'mt-2 [&>div]:bg-yellow-500';
        return 'mt-2';
    };

    const getResponseTextClass = (value: number) => {
        if (value > 1000) return 'text-red-600';
        if (value > 500) return 'text-yellow-600';
        return 'text-green-600';
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">System Memory</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatBytes(memoryUsed)}</div>
                    <Progress
                        value={Math.min(Math.max(memoryPercentage, 0), 100)}
                        className={getUsageProgressClass(memoryPercentage)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        {memoryPercentage.toFixed(1)}% of {formatBytes(memoryTotal)}
                    </p>
                    {heapUsed > 0 && (
                        <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-xs text-muted-foreground">Heap: {formatBytes(heapUsed)} / {formatBytes(heapTotal)} ({heapPercentage.toFixed(1)}%)</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{cpuUsage.toFixed(1)}%</div>
                    <Progress
                        value={Math.min(Math.max(cpuUsage, 0), 100)}
                        className={getUsageProgressClass(cpuUsage)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Load Average: {(metrics?.system?.cpu?.loadAverage || [0, 0, 0]).map((l: number) => l?.toFixed(2) || '0').join(' | ')}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{(metrics?.application?.requests?.total || 0).toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                        <span className="text-green-600">{metrics?.application?.requests?.completed || 0}</span>{' '}completed,{' '}
                        <span className="text-red-600">{metrics?.application?.requests?.failed || 0}</span>{' '}failed
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Active: {metrics?.application?.requests?.active || 0}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${getResponseTextClass(metrics?.application?.responseTime?.average || 0)}`}>
                        {(metrics?.application?.responseTime?.average || 0).toFixed(0)}ms
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Min: {(metrics?.application?.responseTime?.min || 0).toFixed(0)}ms | Max: {(metrics?.application?.responseTime?.max || 0).toFixed(0)}ms
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

const SystemInfoBar = ({ system, diskPercentage, diskUsed, diskTotal, highUsageDisks, formatBytes }) => {
    let diskClass = 'text-foreground';
    if (diskPercentage > 80) {
        diskClass = 'text-red-600';
    } else if (diskPercentage > 60) {
        diskClass = 'text-yellow-600';
    }

    return (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <span>Node.js: <span className="font-medium text-foreground">{system.nodeVersion || 'N/A'}</span></span>
            <span className="hidden sm:inline">•</span>
            <span>PID: <span className="font-medium text-foreground">{system.pid || 'N/A'}</span></span>
            <span className="hidden sm:inline">•</span>
            <span>Platform: <span className="font-medium text-foreground">{system.platform || 'N/A'}</span></span>
            <span className="hidden sm:inline">•</span>
            <span>Host: <span className="font-medium text-foreground">{system.hostname || 'N/A'}</span></span>
            {diskPercentage > 0 && (
                <>
                    High usage detected on <span>{highUsageDisks.map(d => d.fs).join(', ')}</span>
                    <span>Disk: <span className={`font-medium ${diskClass}`}>
                        {diskPercentage.toFixed(1)}% used ({formatBytes(diskUsed)} / {formatBytes(diskTotal)})
                    </span></span>
                </>
            )}
        </div>
    );
};

const OverviewTabContent = ({ metrics, loadBalancer }) => {
    const isCircuitOpen = (loadBalancer?.circuitBreaker as { isOpen?: boolean })?.isOpen;
    const circuitClass = isCircuitOpen 
        ? 'bg-destructive/15 text-destructive' 
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    const circuitText = isCircuitOpen ? 'OPEN' : 'CLOSED';

    return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Database className="h-5 w-5 mr-2" /> Database Connections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between"><span>Active:</span><Badge variant="outline">{metrics?.database?.connections?.active || 0}</Badge></div>
                <div className="flex justify-between"><span>Idle:</span><Badge variant="outline">{metrics?.database?.connections?.idle || 0}</Badge></div>
                <div className="flex justify-between"><span>Total:</span><Badge variant="outline">{metrics?.database?.connections?.total || 0}</Badge></div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Activity className="h-5 w-5 mr-2" /> Load Balancer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between"><span>Active Requests:</span><Badge variant="outline">{(loadBalancer?.activeRequests as number) ?? 0}</Badge></div>
                <div className="flex justify-between"><span>Queue Size:</span><Badge variant="outline">{(loadBalancer?.totalQueueSize as number) ?? 0}</Badge></div>
                <div className="flex justify-between"><span>Circuit Breaker:</span><Badge variant="outline" className={circuitClass}>{circuitText}</Badge></div>
            </CardContent>
        </Card>
    </div>
    );
};

const AlertsTabContent = ({ alertStats, alerts, getSeverityColor, onViewDetails, onResolve }) => (
    <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Total Alerts</CardTitle>
                    <Bell className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg sm:text-2xl font-bold">{alertStats?.total || 0}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Active Alerts</CardTitle>
                    <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg sm:text-2xl font-bold text-red-600">{alertStats?.active || 0}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Resolved</CardTitle>
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg sm:text-2xl font-bold text-green-600">{alertStats?.resolved || 0}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Last 24h</CardTitle>
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg sm:text-2xl font-bold">{alertStats?.last24h || 0}</div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="text-base sm:text-lg">Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
                {(alerts || []).length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-green-500" />
                        <p className="text-sm sm:text-base">No active alerts</p>
                    </div>
                ) : (
                    <div className="space-y-3 sm:space-y-4">
                        {(alerts || []).map((alert) => (
                            <div key={alert.id} className="border rounded-lg p-3 sm:p-4">
                                <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                                    <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3 min-w-0 flex-1">
                                        <Badge className={getSeverityColor(alert.severity)}>
                                            {alert.severity.toUpperCase()}
                                        </Badge>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-medium text-sm sm:text-base truncate">{alert.type}</h4>
                                            <p className="text-xs sm:text-sm text-muted-foreground break-words">{alert.message}</p>
                                            <p className="text-xs text-muted-foreground/70">
                                                {new Date(alert.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full sm:w-auto text-xs sm:text-sm"
                                            onClick={() => onViewDetails(alert)}
                                        >
                                            View Details
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full sm:w-auto text-xs sm:text-sm"
                                            onClick={() => onResolve(alert.id)}
                                        >
                                            Resolve
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    </>
);

const PerformanceTabContent = ({ metrics }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Response Time Metrics
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between">
                    <span>Average:</span>
                    <Badge variant="outline">{(metrics?.application?.responseTime?.average || 0).toFixed(2)}ms</Badge>
                </div>
                <div className="flex justify-between">
                    <span>Minimum:</span>
                    <Badge variant="outline">{(metrics?.application?.responseTime?.min || 0).toFixed(2)}ms</Badge>
                </div>
                <div className="flex justify-between">
                    <span>Maximum:</span>
                    <Badge variant="outline">{(metrics?.application?.responseTime?.max || 0).toFixed(2)}ms</Badge>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Database Performance
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between">
                    <span>Total Queries:</span>
                    <Badge variant="outline">{metrics?.database?.queries?.total || 0}</Badge>
                </div>
                <div className="flex justify-between">
                    <span>Slow Queries:</span>
                    <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        {metrics?.database?.queries?.slow || 0}
                    </Badge>
                </div>
                <div className="flex justify-between">
                    <span>Failed Queries:</span>
                    <Badge variant="outline" className="bg-destructive/15 text-destructive">
                        {metrics?.database?.queries?.failed || 0}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    </div>
);

const DatabaseTabContent = ({ metrics }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center text-base sm:text-lg">
                <Database className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Database Statistics
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold">{metrics?.database?.connections?.active || 0}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Active Connections</p>
                </div>
                <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold">{metrics?.database?.connections?.idle || 0}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Idle Connections</p>
                </div>
                <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold">{metrics?.database?.queries?.total || 0}</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Queries</p>
                </div>
                <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold">{(metrics?.database?.responseTime?.average || 0).toFixed(2)}ms</div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Avg Query Time</p>
                </div>
            </div>
        </CardContent>
    </Card>
);

const AlertDetailsDialog = ({ alert, onClose, onResolve, getSeverityColor }) => {
    if (!alert) return null;
    return (
        <Dialog open={!!alert} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">Alert Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-medium text-sm sm:text-base">Type: {alert.type}</h4>
                        <Badge className={getSeverityColor(alert.severity)}>{alert.severity.toUpperCase()}</Badge>
                    </div>
                    <div>
                        <h4 className="font-medium text-sm sm:text-base">Message:</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground break-words">{alert.message}</p>
                    </div>
                    <div>
                        <h4 className="font-medium text-sm sm:text-base">Timestamp:</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">{new Date(alert.timestamp).toLocaleString()}</p>
                    </div>
                    <div>
                        <h4 className="font-medium text-sm sm:text-base">Data:</h4>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">{JSON.stringify(alert.data, null, 2)}</pre>
                    </div>
                    <div className="flex flex-col space-y-2 sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                            Close
                        </Button>
                        <Button
                            className="w-full sm:w-auto"
                            onClick={() => {
                                onResolve(alert.id);
                                onClose();
                            }}
                        >
                            Resolve Alert
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MonitoringDashboard;
