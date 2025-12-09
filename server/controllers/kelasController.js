import dotenv from 'dotenv';
dotenv.config();

// Get Active Kelas (Public - for dropdowns)
export const getActiveKelas = async (req, res) => {
    try {
        console.log('📋 Getting classes for dropdown');

        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            WHERE status = 'aktif'
            ORDER BY tingkat, nama_kelas
        `;

        const [rows] = await global.dbPool.execute(query);
        console.log(`✅ Found ${rows.length} active classes`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get All Kelas (Admin)
export const getKelas = async (req, res) => {
    try {
        console.log('📋 Getting classes for admin dashboard');

        const query = `
            SELECT id_kelas as id, nama_kelas, tingkat, status
            FROM kelas 
            ORDER BY tingkat, nama_kelas
        `;

        const [rows] = await global.dbPool.execute(query);
        console.log(`✅ Classes retrieved: ${rows.length} items`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error getting classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create Kelas
export const createKelas = async (req, res) => {
    try {
        const { nama_kelas } = req.body;
        console.log('➕ Adding class:', { nama_kelas });

        if (!nama_kelas) {
            return res.status(400).json({ error: 'Nama kelas wajib diisi' });
        }

        // Extract tingkat from nama_kelas (contoh: "X IPA 1" -> tingkat = "X")
        const tingkat = nama_kelas.split(' ')[0];

        const insertQuery = `
            INSERT INTO kelas (nama_kelas, tingkat, status) 
            VALUES (?, ?, 'aktif')
        `;

        const [result] = await global.dbPool.execute(insertQuery, [nama_kelas, tingkat]);
        console.log('✅ Class added successfully:', result.insertId);
        res.json({ message: 'Kelas berhasil ditambahkan', id: result.insertId });
    } catch (error) {
        console.error('❌ Error adding class:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Nama kelas sudah ada' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

// Update Kelas
export const updateKelas = async (req, res) => {
    try {
        const { id } = req.params;
        const { nama_kelas } = req.body;
        console.log('📝 Updating class:', { id, nama_kelas });

        if (!nama_kelas) {
            return res.status(400).json({ error: 'Nama kelas wajib diisi' });
        }

        // Extract tingkat from nama_kelas
        const tingkat = nama_kelas.split(' ')[0];

        const updateQuery = `
            UPDATE kelas 
            SET nama_kelas = ?, tingkat = ?
            WHERE id_kelas = ?
        `;

        const [result] = await global.dbPool.execute(updateQuery, [nama_kelas, tingkat, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Kelas tidak ditemukan' });
        }

        console.log('✅ Class updated successfully');
        res.json({ message: 'Kelas berhasil diupdate' });
    } catch (error) {
        console.error('❌ Error updating class:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete Kelas
export const deleteKelas = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting class:', { id });

        const [result] = await global.dbPool.execute(
            'DELETE FROM kelas WHERE id_kelas = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Kelas tidak ditemukan' });
        }

        console.log('✅ Class deleted successfully');
        res.json({ message: 'Kelas berhasil dihapus' });
    } catch (error) {
        console.error('❌ Error deleting class:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
