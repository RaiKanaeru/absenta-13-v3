import schedule from 'node-cron';
import { createLogger } from '../../utils/logger.js';
import { getHariFromDate, getMySQLDateWIB, getMySQLDateTimeWIB, getWIBTime } from '../../utils/timeUtils.js';

const logger = createLogger('AutoAttendance');

/**
 * Initialize the auto attendance scheduler
 * Runs daily at 23:30 WIB to mark missing attendance
 */
export function initAutoAttendanceScheduler() {
    // Run every day at 23:30 (11:30 PM)
    // 30 23 * * *
    schedule.schedule('30 23 * * *', async () => {
        logger.info('⏰ Starting automatic attendance check...');
        try {
            await processMissingAttendance();
            logger.info('✅ Automatic attendance check completed');
        } catch (error) {
            logger.error('❌ Automatic attendance check failed', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('✅ Auto Attendance Scheduler initialized (Daily at 23:30 WIB)');
}

/**
 * Process missing attendance for the current day
 * Marks empty schedules as 'Tanpa Keterangan'
 */
export async function processMissingAttendance() {
    const todayStr = getMySQLDateWIB();
    const todayName = getHariFromDate(); // Senin, Selasa, etc.
    const currentTime = getMySQLDateTimeWIB();

    // Skip Sundays (Minggu) AND Saturdays (Sabtu) as requested
    if (todayName === 'Minggu' || todayName === 'Sabtu') {
        logger.info('Skipping auto attendance on Weekend (Sabtu/Minggu)');
        return;
    }

    const connection = await global.dbPool.getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. Get all active schedules for TODAY
        const [schedules] = await connection.execute(`
            SELECT j.id_jadwal, j.kelas_id, j.mapel_id, j.guru_id, 
                   k.nama_kelas, m.nama_mapel
            FROM jadwal_pelajaran j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            JOIN mapel m ON j.mapel_id = m.id_mapel
            WHERE j.hari = ? 
            AND j.status = 'aktif'
        `, [todayName]);

        if (schedules.length === 0) {
            logger.info('No schedules found for today');
            await connection.commit();
            return;
        }

        let totalInserted = 0;
        let schedulesProcessed = 0;

        // 2. Iterate through each schedule
        for (const jadwal of schedules) {
            // 3. Check if ANY attendance exists for this schedule today
            const [existing] = await connection.execute(
                'SELECT COUNT(*) as count FROM absensi_siswa WHERE jadwal_id = ? AND tanggal = ?',
                [jadwal.id_jadwal, todayStr]
            );

            if (existing[0].count === 0) {
                // 4. No attendance taken! Treat as "Guru & Siswa forgot" -> "Tanpa Keterangan"
                
                // Get all active students in this class
                const [students] = await connection.execute(
                    'SELECT id_siswa FROM siswa WHERE kelas_id = ? AND status = "aktif"',
                    [jadwal.kelas_id]
                );

                if (students.length > 0) {
                    // Prepare bulk insert
                    // Values: (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas)
                    // Status: 'Tanpa Keterangan' (mapped to 'A' usually, or explicit string if supported)
                    // Note: 'Tanpa Keterangan' is the text description, stored as 'Alpha' or 'A'? 
                    // Let's verify DB enum. Based on exportController, 'Alpa', 'Alpha', 'Tanpa Keterangan' are grouped as A.
                    // absensiController accepts 'Alpa' or 'Alpha'. Let's use 'Tanpa Keterangan' if allowed, or 'Alpha' with note.
                    
                    // We'll use 'Alpha' as the status code (as per typical ENUM), and note 'Auto Generated'.
                    // Or matches the user request literal "Tanpa Keterangan" if column allows varchar.
                    // Usually status column is ENUM or Varchar.
                    // Safest is 'Alpha' and keterangan 'Tanpa Keterangan (Auto)'.
                    
                    const statusVal = 'Alpha'; // Standard status
                    const keteranganVal = 'Tanpa Keterangan (Tidak ada presensi)';
                    
                    // Bulk insert logic
                    const values = students.map(s => [
                        s.id_siswa,
                        jadwal.id_jadwal,
                        todayStr,
                        statusVal,
                        keteranganVal,
                        currentTime,
                        jadwal.guru_id || 0, // Original teacher
                        0, // guru_pengabsen_id = 0 (System)
                        0, // terlambat
                        0  // ada_tugas
                    ]);

                    // Construct placeholder string (?, ?, ...), (...)
                    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
                    const flatValues = values.flat();

                    await connection.execute(
                        `INSERT INTO absensi_siswa 
                         (siswa_id, jadwal_id, tanggal, status, keterangan, waktu_absen, guru_id, guru_pengabsen_id, terlambat, ada_tugas) 
                         VALUES ${placeholders}`,
                        flatValues
                    );

                    totalInserted += students.length;
                    schedulesProcessed++;
                }
            }
        }

        await connection.commit();
        logger.info(`Auto attendance check done. Processed ${schedulesProcessed} empty schedules, inserted ${totalInserted} records.`);

    } catch (error) {
        await connection.rollback();
        logger.error('Error processing auto attendance:', error);
        throw error;
    } finally {
        connection.release();
    }
}
