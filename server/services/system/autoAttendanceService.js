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
        logger.info('Starting automatic attendance check...');
        try {
            await processMissingAttendance();
            logger.info('Automatic attendance check completed');
        } catch (error) {
            logger.error('Automatic attendance check failed', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    logger.info('Auto Attendance Scheduler initialized (Daily at 23:30 WIB)');
}

/**
 * Process missing attendance for the current day
 * Marks empty schedules as 'Tanpa Keterangan'
 */
export async function processMissingAttendance() {
    const todayStr = getMySQLDateWIB();
    const wibNow = getWIBTime();
    const todayName = getHariFromDate(wibNow); // Senin, Selasa, etc.
    const currentTime = getMySQLDateTimeWIB();

    // Skip Sundays (Minggu) AND Saturdays (Sabtu) as requested
    if (todayName === 'Minggu' || todayName === 'Sabtu') {
        logger.info('Skipping auto attendance on Weekend (Sabtu/Minggu)');
        return;
    }

    const connection = await globalThis.dbPool.getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. Get all active schedules for TODAY
        const [schedules] = await connection.execute(`
            SELECT j.id_jadwal, j.kelas_id, j.mapel_id, j.guru_id, 
                   k.nama_kelas, m.nama_mapel
            FROM jadwal j
            JOIN kelas k ON j.kelas_id = k.id_kelas
            LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
            WHERE j.hari = ? 
            AND j.status = 'aktif'
            AND j.is_absenable = 1
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
                    // Use enum value 'Alpa' and keep reason in keterangan.
                    const statusVal = 'Alpa';
                    const keteranganVal = 'Tanpa Keterangan (Tidak ada presensi)';
                    const guruId = jadwal.guru_id || null;
                    
                    // Bulk insert logic
                    const values = students.map(s => [
                        s.id_siswa,
                        jadwal.id_jadwal,
                        todayStr,
                        statusVal,
                        keteranganVal,
                        currentTime,
                        guruId,
                        guruId,
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
