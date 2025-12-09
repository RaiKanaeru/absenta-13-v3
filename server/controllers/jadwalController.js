import dotenv from 'dotenv';
dotenv.config();

// ================================================
// HELPER FUNCTIONS
// ================================================

// Fungsi untuk cek overlap rentang waktu
function isTimeOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
}

// Fungsi validasi format jam 24 jam
function validateTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') {
        return false;
    }
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString.trim());
}

// Fungsi validasi logika waktu
function validateTimeLogic(startTime, endTime) {
    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
        return { valid: false, error: 'Format waktu tidak valid. Gunakan format 24 jam (HH:MM)' };
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
        return { valid: false, error: 'Jam selesai harus setelah jam mulai' };
    }

    return { valid: true };
}

// Fungsi konversi waktu ke menit
function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

// Helper function untuk build query jadwal yang standar untuk semua role
function buildJadwalQuery(role = 'admin', guruId = null) {
    const baseQuery = `
        SELECT 
            j.id_jadwal as id,
            j.kelas_id,
            j.mapel_id, 
            j.guru_id,
            j.ruang_id,
            j.hari,
            j.jam_ke,
            j.jam_mulai,
            j.jam_selesai,
            j.status,
            j.jenis_aktivitas,
            j.is_absenable,
            j.keterangan_khusus,
            j.is_multi_guru,
            k.nama_kelas,
            COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
            COALESCE(g.nama, 'Sistem') as nama_guru,
            rk.kode_ruang,
            rk.nama_ruang,
            rk.lokasi,
            GROUP_CONCAT(CONCAT(jg2.guru_id, ':', g2.nama) ORDER BY jg2.is_primary DESC SEPARATOR '||') as guru_list
        FROM jadwal j
        JOIN kelas k ON j.kelas_id = k.id_kelas
        LEFT JOIN mapel m ON j.mapel_id = m.id_mapel  
        LEFT JOIN guru g ON j.guru_id = g.id_guru
        LEFT JOIN ruang_kelas rk ON j.ruang_id = rk.id_ruang
        LEFT JOIN jadwal_guru jg2 ON j.id_jadwal = jg2.jadwal_id
        LEFT JOIN guru g2 ON jg2.guru_id = g2.id_guru
        WHERE j.status = 'aktif'
    `;

    let whereClause = '';
    let params = [];

    if (role === 'guru' && guruId) {
        whereClause = ' AND (j.guru_id = ? OR jg2.guru_id = ?)';
        params = [guruId, guruId];
    }

    const orderBy = `
        GROUP BY j.id_jadwal
        ORDER BY 
            FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
            j.jam_ke, 
            k.nama_kelas
    `;

    return {
        query: baseQuery + whereClause + orderBy,
        params
    };
}

// Validate teacher schedule conflicts
async function validateScheduleConflicts(guruIds, hari, jam_mulai, jam_selesai, excludeJadwalId = null) {
    try {
        for (const guruId of guruIds) {
            const conflictQuery = `
                SELECT j.id_jadwal, j.hari, j.jam_mulai, j.jam_selesai, j.keterangan_khusus, 
                       COALESCE(m.nama_mapel, j.keterangan_khusus) as nama_mapel,
                       k.nama_kelas
                FROM jadwal j
                LEFT JOIN mapel m ON j.mapel_id = m.id_mapel
                JOIN kelas k ON j.kelas_id = k.id_kelas
                WHERE j.guru_id = ? 
                AND j.hari = ? 
                AND j.status = 'aktif'
                AND (
                    (j.jam_mulai < ? AND j.jam_selesai > ?) OR
                    (j.jam_mulai < ? AND j.jam_selesai > ?) OR
                    (j.jam_mulai >= ? AND j.jam_selesai <= ?)
                )
                ${excludeJadwalId ? 'AND j.id_jadwal != ?' : ''}
            `;

            const params = excludeJadwalId
                ? [guruId, hari, jam_mulai, jam_selesai, jam_selesai, jam_mulai, jam_mulai, jam_selesai, excludeJadwalId]
                : [guruId, hari, jam_mulai, jam_selesai, jam_selesai, jam_mulai, jam_mulai, jam_selesai];

            const [conflicts] = await global.dbPool.execute(conflictQuery, params);

            if (conflicts.length > 0) {
                const conflict = conflicts[0];
                return {
                    hasConflict: true,
                    guruId: guruId,
                    conflict: {
                        jadwal_id: conflict.id_jadwal,
                        hari: conflict.hari,
                        jam_mulai: conflict.jam_mulai,
                        jam_selesai: conflict.jam_selesai,
                        mata_pelajaran: conflict.nama_mapel,
                        kelas: conflict.nama_kelas
                    }
                };
            }
        }

        return { hasConflict: false };
    } catch (error) {
        console.error('Error validating schedule conflicts:', error);
        throw error;
    }
}

// ================================================
// CONTROLLER FUNCTIONS
// ================================================

// Get All Jadwal
export const getJadwal = async (req, res) => {
    try {
        console.log('📅 Getting schedules for admin dashboard');

        const { query, params } = buildJadwalQuery('admin');
        const [rows] = await global.dbPool.execute(query, params);

        console.log(`✅ Schedules retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create Jadwal
export const createJadwal = async (req, res) => {
    try {
        const {
            kelas_id,
            mapel_id,
            guru_id,
            guru_ids,
            ruang_id,
            hari,
            jam_ke,
            jam_mulai,
            jam_selesai,
            jenis_aktivitas = 'pelajaran',
            is_absenable = true,
            keterangan_khusus = null
        } = req.body;

        // Validasi format jam 24 jam
        const timeValidation = validateTimeLogic(jam_mulai, jam_selesai);
        if (!timeValidation.valid) {
            return res.status(400).json({ error: timeValidation.error });
        }

        const finalGuruIds = guru_ids && guru_ids.length > 0 ? guru_ids : (guru_id ? [guru_id] : []);

        console.log('🔍 Debug Multi-Guru:', {
            finalGuruIds,
            guru_ids_from_request: req.body.guru_ids,
            guru_id_from_request: req.body.guru_id
        });

        // Validasi guru_ids sebelum insert (untuk aktivitas pelajaran)
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);

            if (validGuruIds.length === 0) {
                return res.status(400).json({
                    error: 'Tidak ada guru yang valid dipilih'
                });
            }

            // Validasi apakah guru_ids benar-benar ada di database
            const placeholders = validGuruIds.map(() => '?').join(',');
            const [existingGurus] = await global.dbPool.execute(
                `SELECT id_guru, nama FROM guru WHERE id_guru IN (${placeholders})`,
                validGuruIds
            );

            if (existingGurus.length !== validGuruIds.length) {
                const existingIds = existingGurus.map(g => g.id_guru);
                const invalidIds = validGuruIds.filter(id => !existingIds.includes(id));
                console.log('❌ Guru tidak ditemukan:', invalidIds);
                return res.status(400).json({
                    error: `Guru dengan ID ${invalidIds.join(', ')} tidak ditemukan di database`
                });
            }

            console.log('✅ Validasi guru berhasil:', existingGurus.map(g => `${g.id_guru}:${g.nama}`));
        }

        console.log('➕ Adding schedule:', {
            kelas_id, mapel_id, guru_ids: finalGuruIds, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable
        });

        // Validation berbeda untuk aktivitas khusus
        if (jenis_aktivitas === 'pelajaran') {
            if (!kelas_id || !mapel_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
                return res.status(400).json({ error: 'Semua field wajib diisi untuk jadwal pelajaran' });
            }
            if (finalGuruIds.length === 0) {
                return res.status(400).json({ error: 'Minimal satu guru harus dipilih untuk jadwal pelajaran' });
            }
        } else {
            if (!kelas_id || !hari || !jam_mulai || !jam_selesai) {
                return res.status(400).json({ error: 'Kelas, hari, dan waktu wajib diisi' });
            }
        }

        const finalMapelId = jenis_aktivitas === 'pelajaran' ? mapel_id : null;

        let primaryGuruId = null;
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);
            if (validGuruIds.length > 0) {
                primaryGuruId = validGuruIds[0];
            }
        }

        // Check conflicts hanya untuk aktivitas yang membutuhkan ruang/guru
        if (jenis_aktivitas === 'pelajaran') {
            // Check class conflicts
            const [classConflicts] = await global.dbPool.execute(
                `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                 WHERE kelas_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran'`,
                [kelas_id, hari]
            );

            for (const conflict of classConflicts) {
                if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                    return res.status(400).json({
                        error: `Kelas sudah memiliki jadwal pelajaran pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
                    });
                }
            }

            // Validate teacher schedule conflicts
            if (finalGuruIds.length > 0) {
                const conflictValidation = await validateScheduleConflicts(finalGuruIds, hari, jam_mulai, jam_selesai);

                if (conflictValidation.hasConflict) {
                    const { guruId, conflict } = conflictValidation;
                    return res.status(400).json({
                        error: `Guru dengan ID ${guruId} sudah memiliki jadwal bentrok: ${conflict.mata_pelajaran} di ${conflict.kelas} pada ${conflict.hari} ${conflict.jam_mulai}-${conflict.jam_selesai}`
                    });
                }
            }

            // Check room conflicts
            if (ruang_id) {
                const [roomConflicts] = await global.dbPool.execute(
                    `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                     WHERE ruang_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran'`,
                    [ruang_id, hari]
                );

                for (const conflict of roomConflicts) {
                    if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                        return res.status(400).json({
                            error: `Ruang sudah digunakan pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
                        });
                    }
                }
            }
        }

        // Validasi final primaryGuruId sebelum insert
        if (jenis_aktivitas === 'pelajaran' && primaryGuruId) {
            const [guruCheck] = await global.dbPool.execute(
                'SELECT id_guru, nama FROM guru WHERE id_guru = ?',
                [primaryGuruId]
            );

            if (guruCheck.length === 0) {
                console.log('❌ Primary guru tidak ditemukan:', primaryGuruId);
                return res.status(400).json({
                    error: `Guru utama dengan ID ${primaryGuruId} tidak ditemukan di database`
                });
            }

            console.log('✅ Primary guru valid:', guruCheck[0]);
        }

        // Insert jadwal dengan guru utama
        const [result] = await global.dbPool.execute(
            `INSERT INTO jadwal (kelas_id, mapel_id, guru_id, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, status, jenis_aktivitas, is_absenable, keterangan_khusus, is_multi_guru)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?)`,
            [kelas_id, finalMapelId, primaryGuruId, ruang_id || null, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, finalGuruIds.length > 1 ? 1 : 0]
        );

        const jadwalId = result.insertId;

        // Insert semua guru ke jadwal_guru
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            const validGuruIds = finalGuruIds.filter(id => id && !isNaN(id) && id > 0);
            console.log('📝 Inserting jadwal_guru:', { jadwalId, validGuruIds });

            for (let i = 0; i < validGuruIds.length; i++) {
                try {
                    await global.dbPool.execute(
                        'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, ?)',
                        [jadwalId, validGuruIds[i], i === 0 ? 1 : 0]
                    );
                    console.log(`✅ Guru ${validGuruIds[i]} added to jadwal_guru (primary: ${i === 0})`);
                } catch (error) {
                    console.error(`❌ Error inserting guru ${validGuruIds[i]} to jadwal_guru:`, error);
                    throw error;
                }
            }
        }

        console.log('✅ Schedule added successfully');
        res.json({
            message: 'Jadwal berhasil ditambahkan',
            id: jadwalId
        });
    } catch (error) {
        console.error('❌ Error adding schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update Jadwal
export const updateJadwal = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            kelas_id,
            mapel_id,
            guru_id,
            guru_ids,
            ruang_id,
            hari,
            jam_ke,
            jam_mulai,
            jam_selesai,
            jenis_aktivitas = 'pelajaran',
            is_absenable = true,
            keterangan_khusus = null
        } = req.body;

        // Validasi format jam 24 jam
        const timeValidation = validateTimeLogic(jam_mulai, jam_selesai);
        if (!timeValidation.valid) {
            return res.status(400).json({ error: timeValidation.error });
        }

        const finalGuruIds = guru_ids && guru_ids.length > 0 ? guru_ids : (guru_id ? [guru_id] : []);
        const isMultiGuru = finalGuruIds.length > 1;

        console.log('✏️ Updating schedule:', {
            id, kelas_id, mapel_id, guru_id, guru_ids, finalGuruIds, isMultiGuru, ruang_id, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable
        });

        // Validation berbeda untuk aktivitas khusus
        if (jenis_aktivitas === 'pelajaran') {
            if (!kelas_id || !mapel_id || !hari || !jam_ke || !jam_mulai || !jam_selesai) {
                return res.status(400).json({ error: 'Semua field wajib diisi untuk jadwal pelajaran' });
            }
            if (finalGuruIds.length === 0) {
                return res.status(400).json({ error: 'Minimal satu guru harus dipilih untuk jadwal pelajaran' });
            }
        } else {
            if (!kelas_id || !hari || !jam_mulai || !jam_selesai) {
                return res.status(400).json({ error: 'Kelas, hari, dan waktu wajib diisi' });
            }
        }

        const finalMapelId = jenis_aktivitas === 'pelajaran' ? mapel_id : null;
        const finalGuruId = jenis_aktivitas === 'pelajaran' ? (finalGuruIds.length > 0 ? finalGuruIds[0] : null) : null;

        // Check conflicts hanya untuk aktivitas yang membutuhkan ruang/guru
        if (jenis_aktivitas === 'pelajaran') {
            // Check class conflicts (excluding current schedule)
            const [classConflicts] = await global.dbPool.execute(
                `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                 WHERE kelas_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran' AND id_jadwal != ?`,
                [kelas_id, hari, id]
            );

            for (const conflict of classConflicts) {
                if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                    return res.status(400).json({
                        error: `Kelas sudah memiliki jadwal pelajaran pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
                    });
                }
            }

            // Validate teacher schedule conflicts (excluding current schedule)
            if (finalGuruIds.length > 0) {
                const conflictValidation = await validateScheduleConflicts(finalGuruIds, hari, jam_mulai, jam_selesai, id);

                if (conflictValidation.hasConflict) {
                    const { guruId, conflict } = conflictValidation;
                    return res.status(400).json({
                        error: `Guru dengan ID ${guruId} sudah memiliki jadwal bentrok: ${conflict.mata_pelajaran} di ${conflict.kelas} pada ${conflict.hari} ${conflict.jam_mulai}-${conflict.jam_selesai}`
                    });
                }
            }

            // Check room conflicts (if ruang_id provided)
            if (ruang_id) {
                const [roomConflicts] = await global.dbPool.execute(
                    `SELECT id_jadwal, jam_mulai, jam_selesai FROM jadwal 
                     WHERE ruang_id = ? AND hari = ? AND status = 'aktif' AND jenis_aktivitas = 'pelajaran' AND id_jadwal != ?`,
                    [ruang_id, hari, id]
                );

                for (const conflict of roomConflicts) {
                    if (isTimeOverlap(jam_mulai, jam_selesai, conflict.jam_mulai, conflict.jam_selesai)) {
                        return res.status(400).json({
                            error: `Ruang sudah digunakan pada ${hari} jam ${conflict.jam_mulai}-${conflict.jam_selesai}`
                        });
                    }
                }
            }
        }

        const [result] = await global.dbPool.execute(
            `UPDATE jadwal 
             SET kelas_id = ?, mapel_id = ?, guru_id = ?, ruang_id = ?, hari = ?, jam_ke = ?, jam_mulai = ?, jam_selesai = ?, jenis_aktivitas = ?, is_absenable = ?, keterangan_khusus = ?, is_multi_guru = ?
             WHERE id_jadwal = ?`,
            [kelas_id, finalMapelId, finalGuruId, ruang_id || null, hari, jam_ke, jam_mulai, jam_selesai, jenis_aktivitas, is_absenable ? 1 : 0, keterangan_khusus, isMultiGuru ? 1 : 0, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        // Update jadwal_guru table untuk multi-guru schedules
        if (jenis_aktivitas === 'pelajaran' && finalGuruIds.length > 0) {
            console.log('🔄 Updating jadwal_guru table for multi-guru schedule...');

            // Hapus relasi lama
            await global.dbPool.execute(
                'DELETE FROM jadwal_guru WHERE jadwal_id = ?',
                [id]
            );

            // Tambahkan relasi baru
            for (let i = 0; i < finalGuruIds.length; i++) {
                const guruId = finalGuruIds[i];
                const isPrimary = i === 0;

                await global.dbPool.execute(
                    'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, ?)',
                    [id, guruId, isPrimary ? 1 : 0]
                );

                console.log(`✅ Added guru ${guruId} to schedule ${id} (primary: ${isPrimary})`);
            }
        }

        console.log('✅ Schedule updated successfully');
        res.json({ message: 'Jadwal berhasil diperbarui' });
    } catch (error) {
        console.error('❌ Error updating schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete Jadwal
export const deleteJadwal = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting schedule:', { id });

        const [result] = await global.dbPool.execute(
            'DELETE FROM jadwal WHERE id_jadwal = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        console.log('✅ Schedule deleted successfully');
        res.json({ message: 'Jadwal berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ================================================
// MULTI-GURU JADWAL MANAGEMENT
// ================================================

// Get teachers in a schedule
export const getJadwalGuru = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('👥 Getting teachers for schedule:', { id });

        const [rows] = await global.dbPool.execute(`
            SELECT jg.id, jg.guru_id, jg.is_primary, g.nama, g.nip, g.mata_pelajaran
            FROM jadwal_guru jg
            JOIN guru g ON jg.guru_id = g.id_guru
            WHERE jg.jadwal_id = ?
            ORDER BY jg.is_primary DESC, g.nama ASC
        `, [id]);

        console.log(`✅ Found ${rows.length} teachers for schedule ${id}`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting schedule teachers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Add teacher to schedule
export const addJadwalGuru = async (req, res) => {
    try {
        const { guru_id } = req.body;
        const jadwal_id = req.params.id;

        console.log('➕ Adding teacher to schedule:', { jadwal_id, guru_id });

        // Check if guru already in jadwal
        const [exists] = await global.dbPool.execute(
            'SELECT id FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guru_id]
        );

        if (exists.length > 0) {
            return res.status(400).json({ error: 'Guru sudah ditambahkan ke jadwal ini' });
        }

        // Insert guru
        await global.dbPool.execute(
            'INSERT INTO jadwal_guru (jadwal_id, guru_id, is_primary) VALUES (?, ?, 0)',
            [jadwal_id, guru_id]
        );

        // Update is_multi_guru flag
        const [guruCount] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
            [jadwal_id]
        );

        if (guruCount[0].count > 1) {
            await global.dbPool.execute(
                'UPDATE jadwal SET is_multi_guru = 1 WHERE id_jadwal = ?',
                [jadwal_id]
            );
        }

        console.log('✅ Teacher added to schedule successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error adding teacher to schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Remove teacher from schedule
export const removeJadwalGuru = async (req, res) => {
    try {
        const { id: jadwal_id, guruId } = req.params;

        console.log('➖ Removing teacher from schedule:', { jadwal_id, guruId });

        // Check if primary guru
        const [guru] = await global.dbPool.execute(
            'SELECT is_primary FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guruId]
        );

        if (guru.length > 0 && guru[0].is_primary === 1) {
            const [count] = await global.dbPool.execute(
                'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
                [jadwal_id]
            );

            if (count[0].count === 1) {
                return res.status(400).json({ error: 'Tidak bisa menghapus guru terakhir' });
            }
        }

        // Delete guru
        await global.dbPool.execute(
            'DELETE FROM jadwal_guru WHERE jadwal_id = ? AND guru_id = ?',
            [jadwal_id, guruId]
        );

        // Update is_multi_guru flag
        const [guruCount] = await global.dbPool.execute(
            'SELECT COUNT(*) as count FROM jadwal_guru WHERE jadwal_id = ?',
            [jadwal_id]
        );

        if (guruCount[0].count <= 1) {
            await global.dbPool.execute(
                'UPDATE jadwal SET is_multi_guru = 0 WHERE id_jadwal = ?',
                [jadwal_id]
            );
        }

        console.log('✅ Teacher removed from schedule successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error removing teacher from schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
