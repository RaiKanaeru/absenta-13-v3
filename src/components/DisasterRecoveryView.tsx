/**
 * Disaster Recovery Management View
 * Task 8.2: Disaster Recovery Procedures UI
 */

import React, { useState, useEffect } from 'react';
import { 
    Shield, 
    Database, 
    Clock, 
    CheckCircle, 
    AlertTriangle, 
    FileText, 
    Download,
    Upload,
    Settings,
    Activity,
    RefreshCw
} from 'lucide-react';
import { getApiUrl } from '@/config/api';

interface DisasterRecoveryStatus {
    status: string;
    lastBackup?: string;
    nextBackup?: string;
    lastVerification?: string;
    backupCount: number;
    failedBackups?: number;
    recoveryCount?: number;
    lastRecovery?: string;
    backupJobs?: any[];
    recoveryProcedures?: any[];
    health?: {
        schedule: boolean;
        verification: boolean;
        procedures: boolean;
        documentation: boolean;
    };
}

interface BackupVerification {
    timestamp: string;
    backupPath: string;
    backupType: string;
    checksum: string | null;
    size: number;
    integrity: boolean;
    compression: boolean;
    errors: string[];
}

const DisasterRecoveryView: React.FC = () => {
    const [status, setStatus] = useState<DisasterRecoveryStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [verification, setVerification] = useState<BackupVerification | null>(null);
    const [selectedBackup, setSelectedBackup] = useState('');
    const [backupType, setBackupType] = useState('unknown');
    const [testDatabase, setTestDatabase] = useState('absenta_test');
    const [activeTab, setActiveTab] = useState('status');

    // Fetch disaster recovery status
    const fetchStatus = async () => {
        try {
            const response = await fetch(getApiUrl('/api/admin/disaster-recovery-status'), {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                setStatus(data.data);
            }
        } catch (error) {
            console.error('Error fetching disaster recovery status:', error);
        }
    };

    // Setup backup schedule
    const setupBackupSchedule = async () => {
        setLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/admin/setup-backup-schedule'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                alert('Backup schedule setup completed successfully!');
                fetchStatus();
            } else {
                alert('Failed to setup backup schedule');
            }
        } catch (error) {
            console.error('Error setting up backup schedule:', error);
            alert('Error setting up backup schedule');
        } finally {
            setLoading(false);
        }
    };

    // Verify backup
    const verifyBackup = async () => {
        if (!selectedBackup) {
            alert('Please select a backup file to verify');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/admin/verify-backup'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    backupPath: selectedBackup,
                    backupType: backupType
                })
            });
            const data = await response.json();
            if (data.success) {
                setVerification(data.data);
                alert('Backup verification completed!');
            } else {
                alert('Failed to verify backup');
            }
        } catch (error) {
            console.error('Error verifying backup:', error);
            alert('Error verifying backup');
        } finally {
            setLoading(false);
        }
    };

    // Test backup restoration
    const testBackupRestoration = async () => {
        if (!selectedBackup) {
            alert('Please select a backup file to test restoration');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/admin/test-backup-restoration'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    backupPath: selectedBackup,
                    testDatabase: testDatabase
                })
            });
            const data = await response.json();
            if (data.success) {
                alert(`Backup restoration test completed! Duration: ${data.data.duration}ms`);
            } else {
                alert('Failed to test backup restoration');
            }
        } catch (error) {
            console.error('Error testing backup restoration:', error);
            alert('Error testing backup restoration');
        } finally {
            setLoading(false);
        }
    };

    // Get documentation
    const getDocumentation = async () => {
        setLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/admin/disaster-recovery-docs'), {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                // Create and download documentation file
                const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'disaster-recovery-docs.json';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Error getting documentation:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const tabs = [
        { id: 'status', label: 'Status Sistem', icon: Activity },
        { id: 'verification', label: 'Verifikasi Backup', icon: CheckCircle },
        { id: 'restoration', label: 'Restorasi Data', icon: Upload },
        { id: 'documentation', label: 'Dokumentasi', icon: FileText }
    ];

    return (
        <div className="p-3 sm:p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header - Mobile Responsive */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <div className="flex items-center gap-3">
                            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Restorasi Backup</h1>
                        </div>
                    </div>
                    <p className="text-sm sm:text-base text-gray-600">
                        Kelola restorasi, verifikasi, dan prosedur pemulihan backup sistem
                    </p>
                </div>

                {/* Tabs - Mobile Responsive */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex overflow-x-auto space-x-2 sm:space-x-8 scrollbar-hide">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-1 sm:gap-2 py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                                            activeTab === tab.id
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                        <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* Status Tab */}
                {activeTab === 'status' && (
                    <div className="space-y-6">
                        {/* Status Overview - Mobile Responsive */}
                        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">System Status</h2>
                                <button
                                    onClick={fetchStatus}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full sm:w-auto"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </button>
                            </div>

                            {status ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Database className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                                            <span className="font-medium text-gray-900 text-sm sm:text-base">Status</span>
                                        </div>
                                        <p className={`text-xs sm:text-sm ${status.status === 'operational' ? 'text-green-600' : 'text-red-600'}`}>
                                            {status.status.toUpperCase()}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                                            <span className="font-medium text-gray-900 text-sm sm:text-base">Backup Count</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-600">{status.backupCount}</p>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0" />
                                            <span className="font-medium text-gray-900 text-sm sm:text-base">Last Verification</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-600 break-words">
                                            {status.lastVerification ? new Date(status.lastVerification).toLocaleString() : 'Never'}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 flex-shrink-0" />
                                            <span className="font-medium text-gray-900 text-sm sm:text-base">Next Backup</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-600 break-words">
                                            {status.nextBackup ? new Date(status.nextBackup).toLocaleString() : 'Not scheduled'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">Loading status...</p>
                                </div>
                            )}

                            {/* Health Check - Mobile Responsive */}
                            {status && (
                                <div className="mt-6">
                                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3">Health Check</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            {status.health?.schedule ? (
                                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                                            )}
                                            <span className="text-xs sm:text-sm text-gray-700">Schedule</span>
                                        </div>
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            {status.health?.verification ? (
                                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                                            )}
                                            <span className="text-xs sm:text-sm text-gray-700">Verification</span>
                                        </div>
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            {status.health?.procedures ? (
                                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                                            )}
                                            <span className="text-xs sm:text-sm text-gray-700">Procedures</span>
                                        </div>
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            {status.health?.documentation ? (
                                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                                            )}
                                            <span className="text-xs sm:text-sm text-gray-700">Documentation</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Setup Button - Mobile Responsive */}
                            <div className="mt-6">
                                <button
                                    onClick={setupBackupSchedule}
                                    disabled={loading}
                                    className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 w-full sm:w-auto"
                                >
                                    <Settings className="h-4 w-4" />
                                    <span className="text-sm sm:text-base">Setup Automated Backup Schedule</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Verification Tab - Mobile Responsive */}
                {activeTab === 'verification' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Backup Verification</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Backup File Path
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedBackup}
                                        onChange={(e) => setSelectedBackup(e.target.value)}
                                        placeholder="e.g., backups/semester_backup_2025-01-01.sql"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Backup Type
                                    </label>
                                    <select
                                        value={backupType}
                                        onChange={(e) => setBackupType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                    >
                                        <option value="unknown">Unknown</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="semester">Semester</option>
                                    </select>
                                </div>

                                <button
                                    onClick={verifyBackup}
                                    disabled={loading || !selectedBackup}
                                    className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-sm sm:text-base">Verify Backup</span>
                                </button>
                            </div>

                            {/* Verification Results - Mobile Responsive */}
                            {verification && (
                                <div className="mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3">Verification Results</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <div>
                                            <span className="text-xs sm:text-sm font-medium text-gray-700">Timestamp:</span>
                                            <p className="text-xs sm:text-sm text-gray-600 break-words">{new Date(verification.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs sm:text-sm font-medium text-gray-700">Size:</span>
                                            <p className="text-xs sm:text-sm text-gray-600">{verification.size} bytes</p>
                                        </div>
                                        <div>
                                            <span className="text-xs sm:text-sm font-medium text-gray-700">Checksum:</span>
                                            <p className="text-xs sm:text-sm text-gray-600 font-mono break-all">{verification.checksum || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs sm:text-sm font-medium text-gray-700">Integrity:</span>
                                            <p className={`text-xs sm:text-sm ${verification.integrity ? 'text-green-600' : 'text-red-600'}`}>
                                                {verification.integrity ? 'Valid' : 'Invalid'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xs sm:text-sm font-medium text-gray-700">Compression:</span>
                                            <p className={`text-xs sm:text-sm ${verification.compression ? 'text-green-600' : 'text-red-600'}`}>
                                                {verification.compression ? 'Valid' : 'Invalid'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xs sm:text-sm font-medium text-gray-700">Errors:</span>
                                            <p className="text-xs sm:text-sm text-gray-600">{verification.errors.length}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Restoration Tab - Mobile Responsive */}
                {activeTab === 'restoration' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Backup Restoration Test</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Backup File Path
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedBackup}
                                        onChange={(e) => setSelectedBackup(e.target.value)}
                                        placeholder="e.g., backups/semester_backup_2025-01-01.sql"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Test Database Name
                                    </label>
                                    <input
                                        type="text"
                                        value={testDatabase}
                                        onChange={(e) => setTestDatabase(e.target.value)}
                                        placeholder="absenta_test"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                    />
                                </div>

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0" />
                                        <span className="font-medium text-yellow-800 text-sm sm:text-base">Warning</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-yellow-700">
                                        This will test backup restoration by creating a temporary test database. 
                                        The test database will be automatically cleaned up after the test.
                                    </p>
                                </div>

                                <button
                                    onClick={testBackupRestoration}
                                    disabled={loading || !selectedBackup}
                                    className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 w-full sm:w-auto"
                                >
                                    <Upload className="h-4 w-4" />
                                    <span className="text-sm sm:text-base">Test Backup Restoration</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Documentation Tab */}
                {activeTab === 'documentation' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Documentation</h2>
                            
                            <div className="space-y-4">
                                <p className="text-gray-600">
                                    Download the complete disaster recovery procedures documentation including:
                                </p>
                                
                                <ul className="list-disc list-inside text-gray-600 space-y-1">
                                    <li>System overview and backup strategy</li>
                                    <li>Recovery procedures for different scenarios</li>
                                    <li>Testing and validation procedures</li>
                                    <li>Emergency contacts and escalation</li>
                                    <li>Configuration files and locations</li>
                                </ul>

                                <button
                                    onClick={getDocumentation}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                >
                                    <Download className="h-4 w-4" />
                                    Download Documentation
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DisasterRecoveryView;
