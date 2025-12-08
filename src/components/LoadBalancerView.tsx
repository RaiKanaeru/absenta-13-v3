/**
 * Load Balancer & Performance Monitoring View
 * Phase 5: Load Balancing & Traffic Management
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { apiCall } from '@/utils/apiClient';
import { 
    Activity, 
    Server, 
    Database, 
    Zap, 
    AlertTriangle, 
    CheckCircle, 
    XCircle,
    RefreshCw,
    BarChart3,
    Clock,
    Users,
    Trash2
} from 'lucide-react';

interface LoadBalancerStats {
    totalRequests: number;
    activeRequests: number;
    completedRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    circuitBreakerTrips: number;
    burstDetections: number;
    lastBurstTime: string | null;
    circuitBreaker: {
        isOpen: boolean;
        failureCount: number;
        successCount: number;
    };
    queueSizes: {
        critical: number;
        high: number;
        normal: number;
        low: number;
    };
    totalQueueSize: number;
}

interface QueryStats {
    [key: string]: {
        count: number;
        totalTime: number;
        averageTime: number;
        minTime: number;
        maxTime: number;
        successCount: number;
        failureCount: number;
    };
}

interface CacheStats {
    size: number;
    entries: string[];
}

interface SystemPerformance {
    loadBalancer: LoadBalancerStats;
    queryOptimizer: {
        queryStats: QueryStats;
        cacheStats: CacheStats;
    };
    redis: any;
    system: {
        uptime: number;
        memory: {
            used: number;
            total: number;
            external: number;
            arrayBuffers: number;
            systemTotal: number;
            systemUsed: number;
            systemFree: number;
            systemPercentage: number;
        };
        cpu: {
            user: number;
            system: number;
            usage: number;
            cores: number;
            model: string;
            speed: number;
            loadAverage: number[];
        };
        device: {
            platform: string;
            architecture: string;
            hostname: string;
            type: string;
            cores: number;
            totalMemory: number;
            memoryFormatted: string;
        };
    };
}

const LoadBalancerView: React.FC = () => {
    const [performance, setPerformance] = useState<SystemPerformance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(() => {
        // Load auto refresh state from localStorage, default to true
        const saved = localStorage.getItem('loadBalancerAutoRefresh');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [loadBalancerEnabled, setLoadBalancerEnabled] = useState(() => {
        // Load load balancer state from localStorage, default to true
        const saved = localStorage.getItem('loadBalancerEnabled');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const fetchPerformanceData = async () => {
        // If load balancer is disabled, show static disabled state
        if (!loadBalancerEnabled) {
            setPerformance({
                loadBalancer: {
                    totalRequests: 0,
                    activeRequests: 0,
                    completedRequests: 0,
                    failedRequests: 0,
                    averageResponseTime: 0,
                    circuitBreakerTrips: 0,
                    burstDetections: 0,
                    lastBurstTime: null,
                    circuitBreaker: {
                        isOpen: false,
                        failureCount: 0,
                        successCount: 0
                    },
                    queueSizes: {
                        critical: 0,
                        high: 0,
                        normal: 0,
                        low: 0
                    },
                    totalQueueSize: 0
                },
                queryOptimizer: {
                    queryStats: {},
                    cacheStats: { size: 0, entries: [] }
                },
                redis: null,
                system: {
                    uptime: 0,
                    memory: { used: 0, total: 1, external: 0, arrayBuffers: 0 },
                    cpu: { user: 0, system: 0 }
                }
            });
            setError(null);
            setLoading(false);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const data = await apiCall('/api/admin/system-performance', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            // Validate and sanitize memory data
            if (data.data && data.data.system && data.data.system.memory) {
                const memory = data.data.system.memory;
                // Ensure all memory values are valid numbers
                memory.used = typeof memory.used === 'number' && !isNaN(memory.used) ? memory.used : 0;
                memory.total = typeof memory.total === 'number' && !isNaN(memory.total) ? memory.total : 1;
                memory.external = typeof memory.external === 'number' && !isNaN(memory.external) ? memory.external : 0;
                memory.arrayBuffers = typeof memory.arrayBuffers === 'number' && !isNaN(memory.arrayBuffers) ? memory.arrayBuffers : 0;
                
                // Ensure total is not zero to prevent division by zero
                if (memory.total === 0) memory.total = 1;
            }
            
            setPerformance(data.data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformanceData();
        
        let interval: NodeJS.Timeout | null = null;
        
        // Only auto refresh if both autoRefresh is enabled AND load balancer is enabled
        if (autoRefresh && loadBalancerEnabled) {
            interval = setInterval(fetchPerformanceData, 5000); // Refresh every 5 seconds
        }
        
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [autoRefresh, loadBalancerEnabled]);

    const formatBytes = (bytes: number) => {
        // Handle invalid or NaN values
        if (!bytes || isNaN(bytes) || bytes < 0) return '0 Bytes';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds: number) => {
        // Handle invalid or NaN values
        if (!seconds || isNaN(seconds) || seconds < 0) return '0d 0h 0m';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'bg-green-500';
            case 'warning': return 'bg-yellow-500';
            case 'critical': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-100 text-red-800';
            case 'high': return 'bg-orange-100 text-orange-800';
            case 'normal': return 'bg-blue-100 text-blue-800';
            case 'low': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const toggleLoadBalancer = async () => {
        try {
            const newState = !loadBalancerEnabled;
            await apiCall('/api/admin/toggle-load-balancer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled: newState })
            });
            
            setLoadBalancerEnabled(newState);
            localStorage.setItem('loadBalancerEnabled', JSON.stringify(newState));
            // Refresh data to show updated state
            fetchPerformanceData();
        } catch (error) {
            console.error('Failed to toggle load balancer:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col sm:flex-row items-center justify-center h-64 p-4">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <span className="ml-2 text-sm sm:text-base">Loading performance data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm sm:text-base">
                        Error loading performance data: {error}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!performance) {
        return (
            <div className="p-4 sm:p-6">
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm sm:text-base">
                        No performance data available
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const { loadBalancer, queryOptimizer, system } = performance;
    
    // Get query cache stats from load balancer (integrated)
    const queryCacheStats = loadBalancer?.queryCache || { size: 0, entries: [] };
    const queryStats = loadBalancer?.queryStats || {};

    return (
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl font-bold">Load Balancer & Performance</h2>
                    <p className="text-sm sm:text-base text-gray-600">Real-time system performance monitoring</p>
                </div>
                <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                    {/* Load Balancer Toggle */}
                    <Button
                        variant={loadBalancerEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={toggleLoadBalancer}
                        className={`w-full sm:w-auto ${loadBalancerEnabled ? "bg-green-600 hover:bg-green-700" : "border-red-300 text-red-600 hover:bg-red-50"}`}
                    >
                        <Server className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">{loadBalancerEnabled ? 'Load Balancer ON' : 'Load Balancer OFF'}</span>
                        <span className="sm:hidden">{loadBalancerEnabled ? 'ON' : 'OFF'}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            try {
                                await apiCall('/api/admin/clear-cache', {
                                    method: 'POST'
                                });
                                fetchPerformanceData(); // Refresh data
                            } catch (error) {
                                console.error('Failed to clear cache:', error);
                            }
                        }}
                        disabled={!loadBalancerEnabled}
                        className={`w-full sm:w-auto ${!loadBalancerEnabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Clear Cache</span>
                        <span className="sm:hidden">Clear</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const newState = !autoRefresh;
                            setAutoRefresh(newState);
                            // Save to localStorage
                            localStorage.setItem('loadBalancerAutoRefresh', JSON.stringify(newState));
                        }}
                        disabled={!loadBalancerEnabled}
                        className={`w-full sm:w-auto ${!loadBalancerEnabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh && loadBalancerEnabled ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{autoRefresh && loadBalancerEnabled ? 'Auto Refresh ON' : 'Auto Refresh OFF'}</span>
                        <span className="sm:hidden">{autoRefresh && loadBalancerEnabled ? 'Auto ON' : 'Auto OFF'}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchPerformanceData}
                        className="w-full sm:w-auto"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Load Balancer Status Alert */}
            {!loadBalancerEnabled && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm sm:text-base">
                        <strong>Load Balancer DISABLED</strong> - Performance monitoring is paused. 
                        Auto refresh is automatically disabled when load balancer is off.
                    </AlertDescription>
                </Alert>
            )}

            {/* System Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg sm:text-2xl font-bold">{formatUptime(system && typeof system.uptime === 'number' && !isNaN(system.uptime) ? system.uptime : 0)}</div>
                        <p className="text-xs text-muted-foreground">
                            {system && system.device ? `${system.device.type} ${system.device.architecture}` : 'Unknown Device'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Memory</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg sm:text-2xl font-bold">
                            {system && system.memory && system.memory.systemUsed ? 
                                formatBytes(system.memory.systemUsed) : 
                                '0 Bytes'
                            }
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                            of {system && system.device && system.device.memoryFormatted ? 
                                system.device.memoryFormatted : 
                                'Reading...'
                            }
                        </div>
                        <Progress 
                            value={Math.min(Math.max((system && system.memory && typeof system.memory.systemPercentage === 'number' && !isNaN(system.memory.systemPercentage) ? system.memory.systemPercentage : 0), 0), 100)} 
                            className="mt-2"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg sm:text-2xl font-bold">
                            {system && system.cpu && typeof system.cpu.usage === 'number' && !isNaN(system.cpu.usage) ? 
                                system.cpu.usage.toFixed(1) : 
                                '0.0'
                            }%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {system && system.cpu ? `${system.cpu.cores} cores` : 'Unknown'} • {system && system.cpu && system.cpu.model ? system.cpu.model : 'Unknown CPU'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg sm:text-2xl font-bold">
                            {loadBalancer && typeof loadBalancer.totalRequests === 'number' && !isNaN(loadBalancer.totalRequests) ? 
                                loadBalancer.totalRequests.toLocaleString() : 
                                '0'
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {loadBalancer && typeof loadBalancer.completedRequests === 'number' && !isNaN(loadBalancer.completedRequests) ? loadBalancer.completedRequests : 0} completed, {loadBalancer && typeof loadBalancer.failedRequests === 'number' && !isNaN(loadBalancer.failedRequests) ? loadBalancer.failedRequests : 0} failed
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="load-balancer" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="load-balancer" className="text-xs sm:text-sm">Load Balancer</TabsTrigger>
                    <TabsTrigger value="query-optimizer" className="text-xs sm:text-sm">Query Optimizer</TabsTrigger>
                    <TabsTrigger value="system" className="text-xs sm:text-sm">System Info</TabsTrigger>
                </TabsList>

                {/* Load Balancer Tab */}
                <TabsContent value="load-balancer" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        {/* Request Statistics */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Activity className="h-5 w-5 mr-2" />
                                    Request Statistics
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span>Active Requests:</span>
                                    <Badge variant="outline">{loadBalancer && typeof loadBalancer.activeRequests === 'number' && !isNaN(loadBalancer.activeRequests) ? loadBalancer.activeRequests : 0}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span>Completed:</span>
                                    <Badge variant="outline" className="bg-green-100 text-green-800">
                                        {loadBalancer && typeof loadBalancer.completedRequests === 'number' && !isNaN(loadBalancer.completedRequests) ? loadBalancer.completedRequests : 0}
                                    </Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span>Failed:</span>
                                    <Badge variant="outline" className="bg-red-100 text-red-800">
                                        {loadBalancer && typeof loadBalancer.failedRequests === 'number' && !isNaN(loadBalancer.failedRequests) ? loadBalancer.failedRequests : 0}
                                    </Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span>Success Rate:</span>
                                    <Badge variant="outline">
                                        {loadBalancer && typeof loadBalancer.totalRequests === 'number' && !isNaN(loadBalancer.totalRequests) && loadBalancer.totalRequests > 0 ? 
                                            ((loadBalancer && typeof loadBalancer.completedRequests === 'number' && !isNaN(loadBalancer.completedRequests) ? loadBalancer.completedRequests : 0) / loadBalancer.totalRequests * 100).toFixed(1) : 
                                            '0.0'
                                        }%
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Circuit Breaker Status */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    {loadBalancer && loadBalancer.circuitBreaker && loadBalancer.circuitBreaker.isOpen ? (
                                        <XCircle className="h-5 w-5 mr-2 text-red-500" />
                                    ) : (
                                        <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                                    )}
                                    Circuit Breaker
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span>Status:</span>
                                    <Badge 
                                        variant="outline" 
                                        className={loadBalancer && loadBalancer.circuitBreaker && loadBalancer.circuitBreaker.isOpen ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}
                                    >
                                        {loadBalancer && loadBalancer.circuitBreaker && loadBalancer.circuitBreaker.isOpen ? 'OPEN' : 'CLOSED'}
                                    </Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span>Failure Count:</span>
                                    <Badge variant="outline">{loadBalancer && loadBalancer.circuitBreaker && typeof loadBalancer.circuitBreaker.failureCount === 'number' && !isNaN(loadBalancer.circuitBreaker.failureCount) ? loadBalancer.circuitBreaker.failureCount : 0}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span>Success Count:</span>
                                    <Badge variant="outline">{loadBalancer && loadBalancer.circuitBreaker && typeof loadBalancer.circuitBreaker.successCount === 'number' && !isNaN(loadBalancer.circuitBreaker.successCount) ? loadBalancer.circuitBreaker.successCount : 0}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span>Total Trips:</span>
                                    <Badge variant="outline">{loadBalancer && typeof loadBalancer.circuitBreakerTrips === 'number' && !isNaN(loadBalancer.circuitBreakerTrips) ? loadBalancer.circuitBreakerTrips : 0}</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Queue Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Users className="h-5 w-5 mr-2" />
                                Request Queue Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                <div className="text-center">
                                    <div className="text-lg sm:text-2xl font-bold text-red-600">{loadBalancer && loadBalancer.queueSizes && typeof loadBalancer.queueSizes.critical === 'number' && !isNaN(loadBalancer.queueSizes.critical) ? loadBalancer.queueSizes.critical : 0}</div>
                                    <Badge className={`${getPriorityColor('critical')} text-xs`}>Critical</Badge>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg sm:text-2xl font-bold text-orange-600">{loadBalancer && loadBalancer.queueSizes && typeof loadBalancer.queueSizes.high === 'number' && !isNaN(loadBalancer.queueSizes.high) ? loadBalancer.queueSizes.high : 0}</div>
                                    <Badge className={`${getPriorityColor('high')} text-xs`}>High</Badge>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg sm:text-2xl font-bold text-blue-600">{loadBalancer && loadBalancer.queueSizes && typeof loadBalancer.queueSizes.normal === 'number' && !isNaN(loadBalancer.queueSizes.normal) ? loadBalancer.queueSizes.normal : 0}</div>
                                    <Badge className={`${getPriorityColor('normal')} text-xs`}>Normal</Badge>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg sm:text-2xl font-bold text-gray-600">{loadBalancer && loadBalancer.queueSizes && typeof loadBalancer.queueSizes.low === 'number' && !isNaN(loadBalancer.queueSizes.low) ? loadBalancer.queueSizes.low : 0}</div>
                                    <Badge className={`${getPriorityColor('low')} text-xs`}>Low</Badge>
                                </div>
                            </div>
                            <div className="mt-4">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Total Queue Size</span>
                                    <span>{loadBalancer && typeof loadBalancer.totalQueueSize === 'number' && !isNaN(loadBalancer.totalQueueSize) ? loadBalancer.totalQueueSize : 0}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Burst Detection */}
                    {loadBalancer && typeof loadBalancer.burstDetections === 'number' && !isNaN(loadBalancer.burstDetections) && loadBalancer.burstDetections > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center text-orange-600">
                                    <AlertTriangle className="h-5 w-5 mr-2" />
                                    Burst Detection
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span>Burst Detections:</span>
                                        <Badge variant="outline" className="bg-orange-100 text-orange-800">
                                            {loadBalancer && typeof loadBalancer.burstDetections === 'number' && !isNaN(loadBalancer.burstDetections) ? loadBalancer.burstDetections : 0}
                                        </Badge>
                                    </div>
                                    {loadBalancer && loadBalancer.lastBurstTime && typeof loadBalancer.lastBurstTime === 'string' && loadBalancer.lastBurstTime.trim() !== '' && (
                                        <div className="flex justify-between">
                                            <span>Last Burst:</span>
                                            <span className="text-sm text-gray-600">
                                                {new Date(loadBalancer.lastBurstTime).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Query Optimizer Tab */}
                <TabsContent value="query-optimizer" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        {/* Query Cache */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Database className="h-5 w-5 mr-2" />
                                    Query Cache
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span>Cache Size:</span>
                                    <Badge variant="outline">{queryCacheStats.size || 0}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span>Query Types:</span>
                                    <Badge variant="outline">{Object.keys(queryStats).length || 0}</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Query Statistics */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <BarChart3 className="h-5 w-5 mr-2" />
                                    Query Performance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {Object.keys(queryStats).length > 0 ? 
                                        Object.entries(queryStats).map(([queryName, stats]) => (
                                            <div key={queryName} className="border rounded p-2">
                                                <div className="font-medium text-xs sm:text-sm break-words">{queryName}</div>
                                                <div className="text-xs text-gray-600 space-y-1">
                                                    <div className="break-words">Count: {stats && typeof stats.count === 'number' && !isNaN(stats.count) ? stats.count : 0} | Avg: {stats && typeof stats.averageTime === 'number' && !isNaN(stats.averageTime) ? stats.averageTime.toFixed(2) : '0.00'}ms</div>
                                                    <div className="break-words">Success: {stats && typeof stats.successCount === 'number' && !isNaN(stats.successCount) ? stats.successCount : 0} | Failed: {stats && typeof stats.failureCount === 'number' && !isNaN(stats.failureCount) ? stats.failureCount : 0}</div>
                                                </div>
                                            </div>
                                        )) : 
                                        <div className="text-sm text-gray-500">No query statistics available</div>
                                    }
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* System Info Tab */}
                <TabsContent value="system" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        {/* Device Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Server className="h-5 w-5 mr-2" />
                                    Device Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Platform:</span>
                                        <span>{system && system.device ? system.device.type : 'Reading...'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Architecture:</span>
                                        <span>{system && system.device ? system.device.architecture : 'Reading...'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Hostname:</span>
                                        <span>{system && system.device ? system.device.hostname : 'Reading...'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>CPU Cores:</span>
                                        <span>{system && system.cpu ? system.cpu.cores : 'Reading...'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>CPU Model:</span>
                                        <span className="text-right max-w-[150px] sm:max-w-[200px] truncate">
                                            {system && system.cpu ? system.cpu.model : 'Reading...'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>CPU Speed:</span>
                                        <span>{system && system.cpu ? `${system.cpu.speed} MHz` : 'Reading...'}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* System Memory */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Server className="h-5 w-5 mr-2" />
                                    System Memory
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Total Memory:</span>
                                        <span>{system && system.device && system.device.memoryFormatted ? system.device.memoryFormatted : 'Reading...'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Used Memory:</span>
                                        <span>{system && system.memory && system.memory.systemUsed ? formatBytes(system.memory.systemUsed) : '0 Bytes'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Free Memory:</span>
                                        <span>{system && system.memory && system.memory.systemFree ? formatBytes(system.memory.systemFree) : '0 Bytes'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Usage:</span>
                                        <span>{system && system.memory && system.memory.systemPercentage ? system.memory.systemPercentage.toFixed(1) : '0.0'}%</span>
                                    </div>
                                    <Progress 
                                        value={Math.min(Math.max((system && system.memory && typeof system.memory.systemPercentage === 'number' && !isNaN(system.memory.systemPercentage) ? system.memory.systemPercentage : 0), 0), 100)} 
                                        className="mt-2"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                        {/* Process Memory */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Activity className="h-5 w-5 mr-2" />
                                    Process Memory (Node.js)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Heap Used:</span>
                                        <span>{formatBytes(system && system.memory && typeof system.memory.used === 'number' && !isNaN(system.memory.used) ? system.memory.used : 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Heap Total:</span>
                                        <span>{formatBytes(system && system.memory && typeof system.memory.total === 'number' && !isNaN(system.memory.total) ? system.memory.total : 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>External:</span>
                                        <span>{formatBytes(system && system.memory && typeof system.memory.external === 'number' && !isNaN(system.memory.external) ? system.memory.external : 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Array Buffers:</span>
                                        <span>{formatBytes(system && system.memory && typeof system.memory.arrayBuffers === 'number' && !isNaN(system.memory.arrayBuffers) ? system.memory.arrayBuffers : 0)}</span>
                                    </div>
                                    <Progress 
                                        value={Math.min(Math.max(((system && system.memory && typeof system.memory.used === 'number' && !isNaN(system.memory.used) ? system.memory.used : 0) / (system && system.memory && typeof system.memory.total === 'number' && !isNaN(system.memory.total) ? system.memory.total : 1)) * 100, 0), 100)} 
                                        className="mt-2"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* CPU Usage */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Activity className="h-5 w-5 mr-2" />
                                    CPU Usage
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Usage:</span>
                                        <span>{system && system.cpu && typeof system.cpu.usage === 'number' && !isNaN(system.cpu.usage) ? system.cpu.usage.toFixed(1) : '0.0'}%</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>User Time:</span>
                                        <span>{system && system.cpu && typeof system.cpu.user === 'number' && !isNaN(system.cpu.user) ? system.cpu.user : 0}μs</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>System Time:</span>
                                        <span>{system && system.cpu && typeof system.cpu.system === 'number' && !isNaN(system.cpu.system) ? system.cpu.system : 0}μs</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Load Average:</span>
                                        <span>{system && system.cpu && system.cpu.loadAverage ? system.cpu.loadAverage.map(load => load.toFixed(2)).join(', ') : '0.00, 0.00, 0.00'}</span>
                                    </div>
                                    <Progress 
                                        value={Math.min(Math.max((system && system.cpu && typeof system.cpu.usage === 'number' && !isNaN(system.cpu.usage) ? system.cpu.usage : 0), 0), 100)} 
                                        className="mt-2"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default LoadBalancerView;
