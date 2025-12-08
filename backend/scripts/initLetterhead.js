import { setLetterheadGlobal } from '../utils/letterheadService.js';

/**
 * Script untuk menginisialisasi data letterhead default
 */
async function initDefaultLetterhead() {
  try {
    console.log('🚀 Menginisialisasi letterhead default...');
    
    const defaultLetterhead = {
      enabled: true,
      logo: "",
      logoLeftUrl: "/logo-kiri.png", // Path default untuk logo kiri
      logoRightUrl: "/logo-kanan.png", // Path default untuk logo kanan
      lines: [
        { text: "PEMERINTAH DAERAH PROVINSI DKI JAKARTA", fontWeight: "bold" },
        { text: "DINAS PENDIDIKAN", fontWeight: "bold" },
        { text: "SMK NEGERI 13 JAKARTA", fontWeight: "bold" },
        { text: "Jl. Raya Bekasi Km. 18, Cakung, Jakarta Timur 13910", fontWeight: "normal" }
      ],
      alignment: "center"
    };

    const result = await setLetterheadGlobal(defaultLetterhead);
    
    if (result) {
      console.log('✅ Letterhead default berhasil diinisialisasi');
    } else {
      console.log('❌ Gagal menginisialisasi letterhead default');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error initializing default letterhead:', error);
    return false;
  }
}

export { initDefaultLetterhead };
