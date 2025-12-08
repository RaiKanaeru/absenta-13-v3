#!/usr/bin/env node

/**
 * DATABASE OPTIMIZATION RUNNER
 * Script untuk menjalankan optimasi database Phase 1
 */

import DatabaseOptimization from './database-optimization.js';
import fs from 'fs/promises';
import path from 'path';

console.log('🚀 Starting Database Optimization Process...');
console.log('📋 Phase 1: Database Indexing, Connection Pooling, and Partitioning');
console.log('🎯 Target: 150 concurrent users, 250K+ records, 2GB RAM, 2 Core\n');

async function runOptimization() {
    const dbOptimization = new DatabaseOptimization();
    
    try {
        console.log('⏳ Step 1: Initializing database optimization system...');
        await dbOptimization.initialize();
        
        console.log('\n⏳ Step 2: Testing connection pool performance...');
        const stats = dbOptimization.getPoolStats();
        console.log('📊 Connection Pool Statistics:');
        console.log(`   Total Connections: ${stats.totalConnections}`);
        console.log(`   Active Connections: ${stats.activeConnections}`);
        console.log(`   Idle Connections: ${stats.idleConnections}`);
        console.log(`   Queued Requests: ${stats.queuedRequests}`);
        
        console.log('\n⏳ Step 3: Running performance tests...');
        
        // Test concurrent connections
        const concurrentTests = [];
        for (let i = 0; i < 10; i++) {
            concurrentTests.push(
                dbOptimization.execute('SELECT COUNT(*) as count FROM absensi_siswa')
            );
        }
        
        const startTime = Date.now();
        await Promise.all(concurrentTests);
        const endTime = Date.now();
        
        console.log(`✅ Concurrent query test: ${endTime - startTime}ms for 10 parallel queries`);
        
        console.log('\n⏳ Step 4: Testing query performance with indexes...');
        
        // Test optimized queries
        const testQueries = [
            {
                name: 'Student attendance by date (with index)',
                query: 'SELECT COUNT(*) FROM absensi_siswa WHERE tanggal = CURDATE()'
            },
            {
                name: 'Student attendance by status (with index)',
                query: 'SELECT status, COUNT(*) FROM absensi_siswa WHERE tanggal >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY status'
            },
            {
                name: 'Teacher attendance by date (with index)',
                query: 'SELECT COUNT(*) FROM absensi_guru WHERE tanggal = CURDATE()'
            }
        ];
        
        for (const test of testQueries) {
            const startTime = Date.now();
            const [result] = await dbOptimization.execute(test.query);
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            console.log(`✅ ${test.name}: ${executionTime}ms`);
        }
        
        console.log('\n⏳ Step 5: Creating optimization report...');
        
        // Create optimization report
        const report = {
            timestamp: new Date().toISOString(),
            phase: 'Phase 1: Database Optimization',
            status: 'completed',
            optimizations: [
                'Database indexes added for absensi_siswa table',
                'Database indexes added for absensi_guru table',
                'Connection pooling implemented (20 connections)',
                'Archive tables created for data partitioning',
                'Query performance optimized'
            ],
            poolStats: stats,
            performance: {
                concurrentQueries: endTime - startTime,
                connectionLimit: stats.totalConnections,
                targetUsers: 150,
                targetRecords: '250K+'
            },
            nextSteps: [
                'Phase 2: Backup & Archive System',
                'Phase 3: Queue System for Downloads',
                'Phase 4: Caching System with Redis',
                'Phase 5: Load Balancing & Traffic Management'
            ]
        };
        
        // Save report
        const reportDir = './reports';
        await fs.mkdir(reportDir, { recursive: true });
        const reportFile = path.join(reportDir, `database-optimization-report-${new Date().toISOString().split('T')[0]}.json`);
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`📄 Optimization report saved to: ${reportFile}`);
        
        console.log('\n🎉 Database Optimization Phase 1 Completed Successfully!');
        console.log('✅ All indexes added');
        console.log('✅ Connection pooling active');
        console.log('✅ Archive tables created');
        console.log('✅ Performance optimized');
        console.log('\n📋 Ready for Phase 2: Backup & Archive System');
        
        // Close connection pool
        await dbOptimization.close();
        
    } catch (error) {
        console.error('❌ Database optimization failed:', error);
        
        // Create error report
        const errorReport = {
            timestamp: new Date().toISOString(),
            phase: 'Phase 1: Database Optimization',
            status: 'failed',
            error: error.message,
            stack: error.stack
        };
        
        try {
            const reportDir = './reports';
            await fs.mkdir(reportDir, { recursive: true });
            const errorFile = path.join(reportDir, `database-optimization-error-${new Date().toISOString().split('T')[0]}.json`);
            await fs.writeFile(errorFile, JSON.stringify(errorReport, null, 2));
            console.log(`📄 Error report saved to: ${errorFile}`);
        } catch (reportError) {
            console.error('❌ Failed to save error report:', reportError);
        }
        
        process.exit(1);
    }
}

// Run optimization
runOptimization();
