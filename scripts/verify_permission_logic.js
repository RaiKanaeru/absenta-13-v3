import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function verifyJabatanLogic() {
    console.log('Starting Jabatan Logic Verification...');
    
    // Create pool
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        // 1. Check if we have students with these positions
        const [rows] = await pool.execute('SELECT id_siswa, nama, jabatan FROM siswa LIMIT 10');
        console.log('Sample Students:', rows);

        // 2. Simulate the security check logic
        const validJabatan = ['Ketua Kelas', 'Wakil Ketua', 'Sekretaris Kelas', 'Bendahara'];
        
        console.log('\nTesting Logic:');
        rows.forEach(student => {
            const isValid = validJabatan.includes(student.jabatan);
            console.log(`Student: ${student.nama}, Jabatan: ${student.jabatan} => Allowed? ${isValid}`);
        });
        
        // 3. Specifically verify 'Anggota' is rejected
        const anggota = rows.find(r => r.jabatan === 'Anggota');
        if (anggota) {
            console.log(`\nVerified: 'Anggota' (${anggota.nama}) is correctly ${validJabatan.includes('Anggota') ? 'ALLOWED (FAIL)' : 'REJECTED (PASS)'}`);
        } else {
             console.log("\nNote: No student with 'Anggota' found in sample to verify rejection.");
        }

        // 4. Verify 'Ketua Kelas' is accepted
        const ketua = rows.find(r => r.jabatan === 'Ketua Kelas');
        if (ketua) {
            console.log(`Verified: 'Ketua Kelas' (${ketua.nama}) is correctly ${validJabatan.includes('Ketua Kelas') ? 'ALLOWED (PASS)' : 'REJECTED (FAIL)'}`);
        }

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await pool.end();
    }
}

verifyJabatanLogic();
