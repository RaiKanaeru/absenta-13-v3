/**
 * TIMEZONE DATA AUDIT SCRIPT
 * 
 * Purpose: Identify date anomalies in database that may have occurred
 * due to timezone bugs (dates off by ±1 day)
 * 
 * This script:
 * 1. Checks all date fields in absensi_guru and absensi_siswa tables
 * 2. Compares dates with timestamps to find mismatches
 * 3. Identifies records where date is ±1 day from expected
 * 4. Generates detailed report of anomalies
 * 5. Provides recommendations for correction
 * 
 * Usage:
 *   node backend/scripts/auditTimezoneData.js
 * 
 * Output:
 *   - Console report of findings
 *   - JSON file with detailed anomaly data: ./logs/timezone-audit-YYYY-MM-DD.json
 */

import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'absenta13',
    timezone: '+07:00' // WIB timezone
};

// Timezone helpers (same as server_modern.js)
const TIMEZONE = 'Asia/Jakarta';

function formatDateWIB(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    
    return `${year}-${month}-${day}`;
}

// ============================================
// HELPER FUNCTIONS - Extracted to reduce CC
// ============================================

/**
 * Audit guru attendance records
 */
async function auditGuruRecords(connection, anomalies) {
    console.log('📋 Auditing absensi_guru table...');
    
    const [guruRecords] = await connection.execute(`
        SELECT 
            id_absensi,
            jadwal_id,
            guru_id,
            tanggal,
            waktu_catat,
            DATE(waktu_catat) as waktu_catat_date,
            DATEDIFF(tanggal, DATE(waktu_catat)) as day_diff
        FROM absensi_guru
        WHERE waktu_catat IS NOT NULL
        ORDER BY waktu_catat DESC
        LIMIT 10000
    `);
    
    console.log(`   Total records checked: ${guruRecords.length}`);
    
    let guruAnomalies = 0;
    for (const record of guruRecords) {
        if (Math.abs(record.day_diff) >= 1) {
            guruAnomalies++;
            const expectedDate = formatDateWIB(record.waktu_catat);
            anomalies.absensi_guru.push({
                id_absensi: record.id_absensi,
                jadwal_id: record.jadwal_id,
                guru_id: record.guru_id,
                tanggal_stored: record.tanggal,
                waktu_catat: record.waktu_catat,
                expected_date: expectedDate,
                day_difference: record.day_diff,
                issue: record.day_diff > 0 ? 'Date is ahead of timestamp' : 'Date is behind timestamp'
            });
        }
    }
    
    logAnomalySummary('absensi_guru', guruAnomalies, anomalies.absensi_guru);
}

/**
 * Audit siswa attendance records
 */
async function auditSiswaRecords(connection, anomalies) {
    console.log('📋 Auditing absensi_siswa table...');
    
    try {
        const [siswaRecords] = await connection.execute(`
            SELECT 
                id_absensi,
                jadwal_id,
                siswa_id,
                tanggal,
                waktu_absen,
                DATE(waktu_absen) as waktu_absen_date,
                DATEDIFF(tanggal, DATE(waktu_absen)) as day_diff
            FROM absensi_siswa
            WHERE waktu_absen IS NOT NULL
            ORDER BY waktu_absen DESC
            LIMIT 10000
        `);
        
        console.log(`   Total records checked: ${siswaRecords.length}`);
        
        let siswaAnomalies = 0;
        for (const record of siswaRecords) {
            if (Math.abs(record.day_diff) >= 1) {
                siswaAnomalies++;
                const expectedDate = formatDateWIB(record.waktu_absen);
                anomalies.absensi_siswa.push({
                    id_absensi: record.id_absensi,
                    jadwal_id: record.jadwal_id,
                    siswa_id: record.siswa_id,
                    tanggal_stored: record.tanggal,
                    waktu_absen: record.waktu_absen,
                    expected_date: expectedDate,
                    day_difference: record.day_diff,
                    issue: record.day_diff > 0 ? 'Date is ahead of timestamp' : 'Date is behind timestamp'
                });
            }
        }
        
        logAnomalySummary('absensi_siswa', siswaAnomalies, anomalies.absensi_siswa);
    } catch (error) {
        console.log(`   ℹ️  Table absensi_siswa not found or error: ${error.message}\n`);
    }
}

/**
 * Audit banding absen records
 */
async function auditBandingRecords(connection, anomalies) {
    console.log('📋 Auditing pengajuan_banding_absen table...');
    console.log('ℹ️  Note: banding_absen_detail table is deprecated and will be removed');
    
    try {
        const [bandingRecords] = await connection.execute(`
            SELECT 
                id_banding,
                tanggal_absen,
                tanggal_pengajuan,
                tanggal_keputusan,
                DATE(tanggal_pengajuan) as pengajuan_date
            FROM pengajuan_banding_absen
            ORDER BY tanggal_pengajuan DESC
            LIMIT 1000
        `);
        
        console.log(`   Total records checked: ${bandingRecords.length}`);
        
        let bandingAnomalies = 0;
        for (const record of bandingRecords) {
            const absenDate = new Date(record.tanggal_absen);
            const pengajuanDate = new Date(record.tanggal_pengajuan);
            const daysDiff = Math.floor((pengajuanDate - absenDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff < -1 || daysDiff > 30) {
                bandingAnomalies++;
                const expectedPengajuanDate = formatDateWIB(record.tanggal_pengajuan);
                const issue = daysDiff < 0 ? 'Pengajuan before absen (impossible!)' : 'Too long delay (> 30 days)';
                anomalies.pengajuan_banding_absen.push({
                    id_banding: record.id_banding,
                    tanggal_absen: record.tanggal_absen,
                    tanggal_pengajuan: record.tanggal_pengajuan,
                    expected_pengajuan_date: expectedPengajuanDate,
                    days_difference: daysDiff,
                    issue
                });
            }
        }
        
        console.log(`   ⚠️  Anomalies found: ${bandingAnomalies}\n`);
    } catch (error) {
        console.log(`   ℹ️  Table pengajuan_banding_absen not found or error: ${error.message}\n`);
    }
}

/**
 * Log anomaly summary for a table
 */
function logAnomalySummary(tableName, count, anomalyList) {
    console.log(`   ⚠️  Anomalies found: ${count}`);
    if (count > 0) {
        const behind = anomalyList.filter(a => a.day_difference < 0).length;
        const ahead = anomalyList.filter(a => a.day_difference > 0).length;
        console.log(`      - ${behind} dates behind timestamp`);
        console.log(`      - ${ahead} dates ahead of timestamp`);
    }
    console.log('');
}

/**
 * Print audit summary
 */
function printAuditSummary(anomalies) {
    const totalAnomalies = 
        anomalies.absensi_guru.length + 
        anomalies.absensi_siswa.length +
        anomalies.pengajuan_banding_absen.length;
    
    console.log('');
    console.log('═'.repeat(60));
    console.log('📊 AUDIT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Anomalies Found: ${totalAnomalies}`);
    console.log(`  - absensi_guru: ${anomalies.absensi_guru.length}`);
    console.log(`  - absensi_siswa: ${anomalies.absensi_siswa.length}`);
    console.log(`  - pengajuan_banding_absen: ${anomalies.pengajuan_banding_absen.length}`);
    console.log('');
    
    if (totalAnomalies > 0) {
        console.log('⚠️  RECOMMENDED ACTIONS:');
        console.log('   1. Review anomalies in generated JSON report');
        console.log('   2. Verify with stakeholders if dates look incorrect');
        console.log('   3. If corrections needed, use fixTimezoneData.js script');
        console.log('   4. Always backup database before making corrections!');
    } else {
        console.log('✅ No timezone anomalies detected!');
        console.log('   Your data appears to be consistent.');
    }
    console.log('═'.repeat(60));
    console.log('');
    
    return totalAnomalies;
}

/**
 * Save audit report to file
 */
async function saveAuditReport(anomalies, totalAnomalies) {
    const timestamp = new Date().toISOString().split('T')[0];
    const reportPath = path.join('./logs', `timezone-audit-${timestamp}.json`);
    
    // Ensure logs directory exists
    await fs.mkdir('./logs', { recursive: true });
    
    const recommendations = totalAnomalies > 0 
        ? [
            'Review anomalies carefully',
            'Backup database before corrections',
            'Use fixTimezoneData.js for automated fixes',
            'Verify critical records manually'
        ]
        : [
            'No anomalies found',
            'Data appears consistent with WIB timezone'
        ];
    
    const report = {
        audit_date: new Date().toISOString(),
        total_anomalies: totalAnomalies,
        anomalies: anomalies,
        recommendations
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);
}

/**
 * Print sample anomalies
 */
function printSampleAnomalies(anomalies) {
    if (anomalies.absensi_guru.length > 0) {
        console.log('📋 Sample absensi_guru anomalies (first 5):');
        anomalies.absensi_guru.slice(0, 5).forEach((a, i) => {
            console.log(`   ${i + 1}. ID ${a.id_absensi}: ${a.tanggal_stored} (stored) vs ${a.expected_date} (expected) - ${a.issue}`);
        });
        console.log('');
    }
}

// ============================================
// MAIN AUDIT FUNCTION - Now with reduced CC
// ============================================

async function auditTimezoneData() {
    let connection;
    
    try {
        console.log('🔍 Starting Timezone Data Audit...\n');
        
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected\n');
        
        const anomalies = {
            absensi_guru: [],
            absensi_siswa: [],
            pengajuan_banding_absen: [],
            banding_absen_detail: [] // Table deprecated and will be removed
        };
        
        // Run audits
        await auditGuruRecords(connection, anomalies);
        await auditSiswaRecords(connection, anomalies);
        await auditBandingRecords(connection, anomalies);
        
        // Generate and save report
        const totalAnomalies = printAuditSummary(anomalies);
        await saveAuditReport(anomalies, totalAnomalies);
        printSampleAnomalies(anomalies);
        
    } catch (error) {
        console.error('❌ Audit failed:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run audit using top-level await
await auditTimezoneData()
    .then(() => {
        console.log('\n✅ Audit completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Audit failed:', error);
        process.exit(1);
    });
