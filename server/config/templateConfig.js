/**
 * Template Configurations for Excel Import/Export
 * Extracted from templateController.js
 */

const COLUMN_CONFIGS = {
    mapel: {
        basic: [
            { header: 'kode_mapel', key: 'kode_mapel', width: 15 },
            { header: 'nama_mapel', key: 'nama_mapel', width: 25 },
            { header: 'deskripsi', key: 'deskripsi', width: 30 }
        ],
        friendly: [
            { header: 'Kode Mapel', key: 'kode_mapel', width: 15 },
            { header: 'Nama Mapel', key: 'nama_mapel', width: 25 },
            { header: 'Deskripsi', key: 'deskripsi', width: 30 }
        ],
        legacy: [
            { header: 'kode_mapel', key: 'kode_mapel', width: 20 },
            { header: 'nama_mapel', key: 'nama_mapel', width: 30 },
            { header: 'deskripsi', key: 'deskripsi', width: 40 },
            { header: 'status', key: 'status', width: 15 }
        ]
    },
    kelas: {
        basic: [
            { header: 'nama_kelas', key: 'nama_kelas', width: 25 },
            { header: 'tingkat', key: 'tingkat', width: 10 },
            { header: 'jurusan', key: 'jurusan', width: 20 }
        ],
        friendly: [
            { header: 'Nama Kelas', key: 'nama_kelas', width: 25 },
            { header: 'Tingkat', key: 'tingkat', width: 10 },
            { header: 'Jurusan', key: 'jurusan', width: 20 }
        ],
        legacy: [
            { header: 'nama_kelas', key: 'nama_kelas', width: 25 },
            { header: 'tingkat', key: 'tingkat', width: 10 },
            { header: 'status', key: 'status', width: 15 }
        ]
    },
    ruang: {
        basic: [
            { header: 'kode_ruang', key: 'kode_ruang', width: 15 },
            { header: 'nama_ruang', key: 'nama_ruang', width: 25 },
            { header: 'kapasitas', key: 'kapasitas', width: 12 },
            { header: 'lokasi', key: 'lokasi', width: 30 }
        ],
        friendly: [
            { header: 'Kode Ruang', key: 'kode_ruang', width: 15 },
            { header: 'Nama Ruang', key: 'nama_ruang', width: 25 },
            { header: 'Kapasitas', key: 'kapasitas', width: 12 },
            { header: 'Lokasi', key: 'lokasi', width: 30 }
        ],
        legacy: [
            { header: 'nama_ruang', key: 'nama_ruang', width: 30 },
            { header: 'kapasitas', key: 'kapasitas', width: 15 },
            { header: 'lokasi', key: 'lokasi', width: 30 },
            { header: 'status', key: 'status', width: 15 }
        ]
    },
    siswa: {
        basic: [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Nomor Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        friendly: [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Nomor Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ]
    },
    guru: {
        basic: [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telepon', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        friendly: [
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telepon', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Mata Pelajaran', key: 'mata_pelajaran', width: 25 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        legacy: [
            { header: 'nip', key: 'nip', width: 20 },
            { header: 'nama', key: 'nama', width: 30 },
            { header: 'jenis_kelamin', key: 'jenis_kelamin', width: 15 },
            { header: 'email', key: 'email', width: 30 },
            { header: 'alamat', key: 'alamat', width: 40 },
            { header: 'no_telepon', key: 'no_telepon', width: 15 },
            { header: 'jabatan', key: 'jabatan', width: 20 },
            { header: 'status', key: 'status', width: 15 }
        ]
    },
    studentAccount: {
        basic: [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        friendly: [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Kelas *', key: 'kelas', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Telepon Orang Tua', key: 'telepon_orangtua', width: 20 },
            { header: 'Telepon Siswa', key: 'nomor_telepon_siswa', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ]
    },
    teacherAccount: {
        basic: [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telp', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ],
        friendly: [
            { header: 'Nama Lengkap *', key: 'nama', width: 30 },
            { header: 'Username *', key: 'username', width: 20 },
            { header: 'Password *', key: 'password', width: 20 },
            { header: 'NIP *', key: 'nip', width: 20 },
            { header: 'Jenis Kelamin *', key: 'jenis_kelamin', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'No. Telepon', key: 'no_telp', width: 20 },
            { header: 'Alamat', key: 'alamat', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ]
    },
    jadwal: {
        basic: [
            { header: 'kelas_id', key: 'kelas_id', width: 12 },
            { header: 'mapel_id', key: 'mapel_id', width: 12 },
            { header: 'guru_id', key: 'guru_id', width: 12 },
            { header: 'ruang_id', key: 'ruang_id', width: 12 },
            { header: 'hari', key: 'hari', width: 15 },
            { header: 'jam_ke', key: 'jam_ke', width: 10 },
            { header: 'jam_mulai', key: 'jam_mulai', width: 12 },
            { header: 'jam_selesai', key: 'jam_selesai', width: 12 },
            { header: 'jenis_aktivitas', key: 'jenis_aktivitas', width: 18 },
            { header: 'keterangan_khusus', key: 'keterangan_khusus', width: 25 }
        ],
        friendly: [
            { header: 'Kelas', key: 'kelas', width: 20 },
            { header: 'Mata Pelajaran', key: 'mapel', width: 25 },
            { header: 'Guru', key: 'guru', width: 25 },
            { header: 'Ruang', key: 'ruang', width: 20 },
            { header: 'Hari', key: 'hari', width: 15 },
            { header: 'Jam Ke', key: 'jam_ke', width: 10 },
            { header: 'Jam Mulai', key: 'jam_mulai', width: 12 },
            { header: 'Jam Selesai', key: 'jam_selesai', width: 12 },
            { header: 'Guru Tambahan', key: 'guru_tambahan', width: 25 }
        ],
        legacy: [
            { header: 'hari', key: 'hari', width: 15 },
            { header: 'jam_ke', key: 'jam_ke', width: 10 },
            { header: 'jam_mulai', key: 'jam_mulai', width: 12 },
            { header: 'jam_selesai', key: 'jam_selesai', width: 12 },
            { header: 'kelas', key: 'kelas', width: 15 },
            { header: 'mapel', key: 'mapel', width: 25 },
            { header: 'guru', key: 'guru', width: 25 },
            { header: 'ruang', key: 'ruang', width: 20 }
        ]
    }
};

const SAMPLE_DATA = {
    mapel: { kode_mapel: 'BING-02', nama_mapel: 'Bahasa Inggris Wajib', deskripsi: 'Contoh deskripsi', status: 'aktif' },
    kelas: { nama_kelas: 'X IPA 3', tingkat: 'X', status: 'aktif' },
    ruang: { nama_ruang: 'Lab Komputer 1', kapasitas: 40, lokasi: 'Gedung A Lt. 2', status: 'aktif' },
    siswa: { nis: '25001', nama: 'Ahmad Rizki', kelas: 'X IPA 1', jenis_kelamin: 'L', telepon_orangtua: '0811223344', nomor_telepon_siswa: '0812334455', alamat: 'Jl. Melati No. 1', status: 'aktif' },
    guru: { nip: '198501012010011001', nama: 'Budi Santoso', jenis_kelamin: 'L', email: 'budi@sekolah.id', no_telepon: '081234567890', alamat: 'Jl. Pendidikan No. 1', jabatan: 'Guru Matematika', status: 'aktif' },
    studentAccount: { nama: 'Ahmad Rizki', username: 'ahmad.rizki', password: 'Siswa123!', nis: '25001', kelas: 'X IPA 1', jabatan: 'Ketua Kelas', jenis_kelamin: 'L', email: 'ahmad.rizki@sekolah.id', telepon_orangtua: '0811223344', nomor_telepon_siswa: '0812334455', alamat: 'Jl. Melati No. 1', status: 'aktif' },
    teacherAccount: { nama: 'Budi Santoso', username: 'budi.santoso', password: 'Guru123!', nip: '198501012010011001', jenis_kelamin: 'L', email: 'budi@sekolah.id', no_telp: '081234567890', alamat: 'Jl. Pendidikan No. 1', status: 'aktif' },
    jadwal: { hari: 'Senin', jam_ke: 1, jam_mulai: '07:00', jam_selesai: '07:45', kelas: 'X IPA 1', mapel: 'Matematika Wajib', guru: 'Budi Santoso', ruang: 'Ruang 101' }
};

const GUIDE_DATA = {
    studentAccount: [
        { kolom: 'nama', deskripsi: 'Nama lengkap siswa', contoh: 'Ahmad Rizki', wajib: 'Ya' },
        { kolom: 'username', deskripsi: 'Username untuk login (unik)', contoh: 'ahmad.rizki', wajib: 'Ya' },
        { kolom: 'password', deskripsi: 'Password untuk login (min 6 karakter)', contoh: 'Siswa123!', wajib: 'Ya' },
        { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik)', contoh: '25001', wajib: 'Ya' },
        { kolom: 'kelas', deskripsi: 'Nama kelas siswa', contoh: 'X IPA 1', wajib: 'Ya' },
        { kolom: 'jenis_kelamin', deskripsi: 'L atau P', contoh: 'L', wajib: 'Ya' }
    ],
    teacherAccount: [
        { kolom: 'nama', deskripsi: 'Nama lengkap guru', wajib: 'Ya' },
        { kolom: 'username', deskripsi: 'Username untuk login (unik)', wajib: 'Ya' },
        { kolom: 'password', deskripsi: 'Password (min 6 karakter)', wajib: 'Ya' },
        { kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik)', wajib: 'Ya' },
        { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
    ],
    siswa: [
        { kolom: 'nis', deskripsi: 'Nomor Induk Siswa (unik)', wajib: 'Ya' },
        { kolom: 'nama', deskripsi: 'Nama lengkap siswa', wajib: 'Ya' },
        { kolom: 'kelas', deskripsi: 'Nama kelas (lihat referensi)', wajib: 'Ya' },
        { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
    ],
    guru: [
        { kolom: 'nip', deskripsi: 'Nomor Induk Pegawai (unik)', wajib: 'Ya' },
        { kolom: 'nama', deskripsi: 'Nama lengkap guru', wajib: 'Ya' },
        { kolom: 'jenis_kelamin', deskripsi: 'L atau P', wajib: 'Ya' }
    ],
    jadwal: [
        { petunjuk: '1. Hari: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu' },
        { petunjuk: '2. jam_ke: Angka urutan jam pelajaran (1, 2, 3, dst)' },
        { petunjuk: '3. jam_mulai dan jam_selesai: Format HH:MM (contoh: 07:00)' },
        { petunjuk: '4. kelas: Nama kelas yang sudah terdaftar di sistem' },
        { petunjuk: '5. mapel: Nama mata pelajaran yang sudah terdaftar' },
        { petunjuk: '6. guru: Nama guru yang sudah terdaftar' },
        { petunjuk: '7. ruang: Nama ruang yang sudah terdaftar (opsional)' }
    ],
    guruLegacy: [
        { petunjuk: '1. nip: Nomor Induk Pegawai (wajib, harus unik)' },
        { petunjuk: '2. nama: Nama lengkap guru (wajib)' },
        { petunjuk: '3. jenis_kelamin: L (Laki-laki) atau P (Perempuan)' },
        { petunjuk: '4. email: Alamat email (opsional)' },
        { petunjuk: '5. alamat: Alamat tempat tinggal (opsional)' },
        { petunjuk: '6. no_telepon: Nomor telepon (opsional)' },
        { petunjuk: '7. jabatan: Jabatan guru (opsional)' },
        { petunjuk: '8. status: aktif atau nonaktif (default: aktif)' }
    ]
};

export { COLUMN_CONFIGS, SAMPLE_DATA, GUIDE_DATA };
